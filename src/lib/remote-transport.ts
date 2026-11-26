import {
  isAllowedDownloadSource,
  isBlockedDownloadHost,
} from './remote-address';

declare const __DIR_WORKERS_PUBLIC_EGRESS__: boolean;
export function isWorkersRuntime(): boolean {
  return (
    (typeof navigator !== 'undefined' &&
      navigator.userAgent === 'Cloudflare-Workers') ||
    'Cloudflare' in globalThis
  );
}
export function assertWorkersPublicEgress() {
  if (
    typeof __DIR_WORKERS_PUBLIC_EGRESS__ === 'undefined' ||
    !__DIR_WORKERS_PUBLIC_EGRESS__
  ) {
    throw new Error('Workers public-egress build policy is not configured');
  }
}
export async function resolvePublicAddresses(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, '');
  if (isBlockedDownloadHost(host)) throw new Error('Forbidden remote address');
  const { isIP } = await import('node:net');
  const family = isIP(host);
  if (family) return [{ address: host, family }];
  const { lookup } = await import('node:dns/promises');
  const addresses = await lookup(host, { all: true, order: 'ipv4first' });
  if (
    !addresses.length ||
    addresses.some(
      (item) => !isIP(item.address) || isBlockedDownloadHost(item.address)
    )
  )
    throw new Error('Forbidden remote address');
  return addresses;
}
/** Every connection uses its own validated lookup result; no preflight/fetch TOCTOU or global agent. */
export async function requestPublicRemote(
  target: URL,
  signal: AbortSignal
): Promise<Response> {
  if (!isAllowedDownloadSource(target))
    throw new Error('Forbidden remote source');
  if (signal.aborted) throw signal.reason;
  if (isWorkersRuntime()) {
    // Workers has no arbitrary-host IP pinning (node:http.lookup is unsupported).
    // The CF build enforces global_fetch_strictly_public: the platform checks actual
    // outbound destinations, while native fetch preserves CDN TLS/SNI and streaming.
    assertWorkersPublicEgress();
    return fetch(target, { redirect: 'manual', signal });
  }
  const { request } =
    target.protocol === 'https:'
      ? await import('node:https')
      : await import('node:http');
  const { Readable } = await import('node:stream');
  const zlib = await import('node:zlib');
  return new Promise<Response>((resolve, reject) => {
    const req = request(
      target,
      {
        agent: false,
        signal,
        ...({
          autoSelectFamily: true,
          autoSelectFamilyAttemptTimeout: 5000,
        } satisfies Pick<
          import('node:net').TcpNetConnectOpts,
          'autoSelectFamily' | 'autoSelectFamilyAttemptTimeout'
        >),
        // URL hostname is unchanged: Node supplies the original Host, TLS SNI and
        // normal certificate verification. Only the DNS callback is constrained.
        lookup(host, options, callback) {
          resolvePublicAddresses(host).then(
            (addresses) => {
              if (signal.aborted) {
                callback(new Error('Remote transfer canceled'), '', 4);
                return;
              }
              const candidates = options.family
                ? addresses.filter((item) => item.family === options.family)
                : addresses;
              if (!candidates.length) {
                callback(
                  new Error('No public address for requested family'),
                  '',
                  4
                );
                return;
              }
              if (options.all) callback(null, candidates);
              else
                callback(null, candidates[0]!.address, candidates[0]!.family);
            },
            () =>
              callback(new Error('Remote address resolution rejected'), '', 4)
          );
        },
        headers: {
          accept: '*/*',
          'accept-encoding': 'identity',
          'user-agent': 'ShipanyDir-Media/1.0',
        },
      },
      (incoming) => {
        const headers = new Headers();
        for (const [name, value] of Object.entries(incoming.headers)) {
          if (value !== undefined)
            headers.set(name, Array.isArray(value) ? value.join(', ') : value);
        }
        let readable: import('node:stream').Readable = incoming;
        const encoding = headers.get('content-encoding')?.toLowerCase();
        const decoder =
          encoding === 'gzip'
            ? zlib.createGunzip()
            : encoding === 'deflate'
              ? zlib.createInflate()
              : encoding === 'br'
                ? zlib.createBrotliDecompress()
                : null;
        if (decoder) {
          incoming.on('error', (error) => decoder.destroy(error));
          decoder.on('error', () => incoming.destroy());
          decoder.on('close', () => {
            if (!incoming.complete) incoming.destroy();
          });
          readable = incoming.pipe(decoder);
          headers.delete('content-encoding');
          headers.delete('content-length');
        }
        const status = incoming.statusCode || 502;
        const body = [204, 205, 304].includes(status)
          ? null
          : (Readable.toWeb(readable) as ReadableStream<Uint8Array>);
        if (!body) incoming.resume();
        resolve(new Response(body, { status, headers }));
      }
    );
    req.on('error', reject);
    req.end();
  });
}
