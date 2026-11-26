import { isAllowedDownloadSource } from './remote-address';
import {
  assertWorkersPublicEgress,
  isWorkersRuntime,
  requestPublicRemote,
  resolvePublicAddresses,
} from './remote-transport';

export {
  isAllowedDownloadSource,
  isBlockedDownloadHost,
  normalizeIpv4Literal,
} from './remote-address';

/** Advisory preflight only. Actual requests enforce address policy at connection time. */
export async function assertAllowedDownloadSource(
  target: URL
): Promise<boolean> {
  if (!isAllowedDownloadSource(target)) return false;
  try {
    if (isWorkersRuntime()) assertWorkersPublicEgress();
    else await resolvePublicAddresses(target.hostname);
    return true;
  } catch {
    return false;
  }
}

export function safeFilename(input: string | null, fallback: string) {
  const raw = (input || fallback).split(/[\\/]/).pop() || fallback;
  const cleaned = raw
    .replace(/["\r\n]/g, '')
    .trim()
    .slice(0, 120);
  return cleaned || fallback;
}

/** ASCII fallback + RFC 5987 filename* — raw CJK in headers breaks downloads. */
export function contentDispositionAttachment(filename: string): string {
  const ext = filename.match(/\.[A-Za-z0-9]{1,8}$/)?.[0] || '';
  const base = ext ? filename.slice(0, -ext.length) : filename;
  const asciiBase =
    base.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_') || 'download';
  const asciiName = `${asciiBase}${ext || ''}`.slice(0, 120);
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encoded}`;
}

/**
 * Same-origin proxy href for `<a download>` / fetch. Cross-origin CDN URLs
 * ignore the download attribute and would just navigate away.
 */
export function buildStorageDownloadUrl(
  src: string,
  name?: string | null
): string {
  const params = new URLSearchParams({ url: src });
  const trimmed = name?.trim();
  if (trimmed) params.set('name', trimmed);
  return `/api/storage/download?${params.toString()}`;
}

export const DEFAULT_REMOTE_FETCH_MAX_BYTES = 50 * 1024 * 1024;
// Proxy streams may include original high-resolution assets. Do not buffer them.
export const DOWNLOAD_MAX_BYTES = 512 * 1024 * 1024;
export const DOWNLOAD_TIMEOUT_MS = 20 * 60_000;
const ERROR_PREFIX_BYTES = 4096;

export class RemoteAssetError extends Error {
  constructor(
    message: string,
    readonly status = 502
  ) {
    super(message);
    this.name = 'RemoteAssetError';
  }
}
export interface RemoteFetchOptions {
  maxBytes?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}
export function remoteTimeoutForBytes(bytes: number): number {
  if (bytes <= 25 * 1024 * 1024) return 3 * 60_000;
  if (bytes <= 30 * 1024 * 1024) return 4 * 60_000;
  if (bytes <= 100 * 1024 * 1024) return 10 * 60_000;
  return DOWNLOAD_TIMEOUT_MS;
}
function cancelBody(body: ReadableStream<Uint8Array> | null, reason?: unknown) {
  // Cancellation must not itself hold the request open on an uncooperative upstream.
  void body?.cancel(reason).catch(() => {});
}
function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const aborted = () => {
      signal.removeEventListener('abort', aborted);
      reject(signal.reason);
    };
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    signal.addEventListener('abort', aborted, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', aborted);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', aborted);
        reject(error);
      }
    );
  });
}
/** One deadline covers module loading, DNS, connect/TLS, all redirects and body consumption. */
export async function fetchAllowedRemoteResponse(
  rawUrl: string,
  options: RemoteFetchOptions = {}
): Promise<Response> {
  const maxBytes = options.maxBytes ?? DEFAULT_REMOTE_FETCH_MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? remoteTimeoutForBytes(maxBytes);
  if (
    !Number.isSafeInteger(maxBytes) ||
    maxBytes <= 0 ||
    !Number.isFinite(timeoutMs) ||
    timeoutMs <= 0
  )
    throw new RemoteAssetError('Invalid remote transfer limits', 500);
  const controller = new AbortController();
  const timedOut = () =>
    controller.abort(new RemoteAssetError('Remote transfer timed out', 504));
  const timer = setTimeout(timedOut, timeoutMs);
  const onAbort = () =>
    controller.abort(new RemoteAssetError('Remote transfer canceled', 499));
  options.signal?.addEventListener('abort', onAbort, { once: true });
  if (options.signal?.aborted) onAbort();
  const finish = () => {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onAbort);
  };
  try {
    let target: URL;
    try {
      target = new URL(rawUrl);
    } catch {
      throw new RemoteAssetError('Invalid remote URL', 400);
    }
    for (let redirects = 0; redirects <= 5; redirects++) {
      if (
        !isAllowedDownloadSource(target) ||
        target.username ||
        target.password
      )
        throw new RemoteAssetError('Forbidden remote source', 403);
      const pending = requestPublicRemote(target, controller.signal);
      void pending.then(
        (response) => {
          if (controller.signal.aborted) cancelBody(response.body);
        },
        () => {}
      );
      const upstream = await abortable(pending, controller.signal);
      if ([301, 302, 303, 307, 308].includes(upstream.status)) {
        const location = upstream.headers.get('location');
        cancelBody(upstream.body);
        if (!location || redirects === 5)
          throw new RemoteAssetError('Failed to follow remote redirect');
        try {
          target = new URL(location, target);
        } catch {
          throw new RemoteAssetError('Invalid redirect URL', 400);
        }
        if (!isAllowedDownloadSource(target))
          throw new RemoteAssetError('Forbidden redirect', 403);
        continue;
      }
      // Never include supplier bodies/URLs in errors (they can contain signed URLs or credentials).
      if (!upstream.ok) {
        const reader = upstream.body?.getReader();
        if (reader) {
          try {
            let read = 0;
            while (read < Math.min(ERROR_PREFIX_BYTES, maxBytes)) {
              const chunk = await abortable(reader.read(), controller.signal);
              if (chunk.done) break;
              read += chunk.value.byteLength;
            }
          } finally {
            void reader.cancel().catch(() => {});
          }
        }
        throw new RemoteAssetError(
          `Remote returned ${upstream.status}`,
          upstream.status >= 400 && upstream.status < 600
            ? upstream.status
            : 502
        );
      }
      const length = Number(upstream.headers.get('content-length'));
      if (Number.isFinite(length) && length > maxBytes) {
        cancelBody(upstream.body);
        throw new RemoteAssetError('Remote body exceeds size limit', 413);
      }
      if (!upstream.body) {
        finish();
        return upstream;
      }
      const reader = upstream.body.getReader();
      let ended = false;
      let total = 0;
      let bodyAbort: () => void;
      const done = () => {
        ended = true;
        controller.signal.removeEventListener('abort', bodyAbort);
        finish();
      };
      const body = new ReadableStream<Uint8Array>(
        {
          start(stream) {
            bodyAbort = () => {
              if (ended) return;
              done();
              stream.error(controller.signal.reason);
              void reader.cancel(controller.signal.reason).catch(() => {});
            };
            controller.signal.addEventListener('abort', bodyAbort, {
              once: true,
            });
            if (controller.signal.aborted) bodyAbort();
          },
          async pull(stream) {
            try {
              const chunk = await reader.read();
              if (ended) return;
              if (chunk.done) {
                done();
                stream.close();
                return;
              }
              total += chunk.value.byteLength;
              if (total > maxBytes)
                throw new RemoteAssetError(
                  'Remote body exceeds size limit',
                  413
                );
              stream.enqueue(chunk.value);
            } catch (error) {
              if (ended) return;
              done();
              stream.error(error);
              controller.abort(error);
              void reader.cancel(error).catch(() => {});
            }
          },
          cancel(reason) {
            if (!ended) {
              done();
              controller.abort(reason);
              void reader.cancel(reason).catch(() => {});
            }
          },
        },
        { highWaterMark: 0 }
      );
      return new Response(body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: upstream.headers,
      });
    }
    throw new RemoteAssetError('Too many remote redirects');
  } catch (error) {
    finish();
    controller.abort(error);
    if (error instanceof RemoteAssetError) throw error;
    if (controller.signal.reason instanceof RemoteAssetError)
      throw controller.signal.reason;
    throw new RemoteAssetError('Remote transfer failed');
  }
}
export async function fetchAllowedRemoteBuffer(
  rawUrl: string,
  options: RemoteFetchOptions = {}
): Promise<Uint8Array> {
  const response = await fetchAllowedRemoteResponse(rawUrl, options);
  return new Uint8Array(await response.arrayBuffer());
}
