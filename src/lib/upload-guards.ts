/**
 * Upload request guards — content-length precheck + magic-byte sniffing so
 * clients cannot rely on a forged Content-Type alone.
 */

export function contentLengthExceeds(
  request: Request,
  maxBytes: number
): boolean {
  const raw = request.headers.get('content-length');
  if (!raw) return false;
  const n = Number(raw);
  return Number.isFinite(n) && n > maxBytes;
}

function asciiAt(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

export function detectImageExtension(bytes: Uint8Array): string | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return 'jpg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'png';
  }
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46
  ) {
    return 'gif';
  }
  if (
    bytes.length >= 12 &&
    asciiAt(bytes, 0, 4) === 'RIFF' &&
    asciiAt(bytes, 8, 4) === 'WEBP'
  ) {
    return 'webp';
  }
  if (bytes.length >= 12 && asciiAt(bytes, 4, 4) === 'ftyp') {
    const brand = asciiAt(bytes, 8, 4).toLowerCase();
    if (brand === 'avif' || brand === 'avis') return 'avif';
    if (
      brand === 'heic' ||
      brand === 'heif' ||
      brand === 'mif1' ||
      brand === 'msf1'
    ) {
      return 'heic';
    }
  }
  return null;
}

export function contentTypeForImageExt(ext: string): string {
  switch (ext) {
    case 'jpg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'avif':
      return 'image/avif';
    case 'heic':
      return 'image/heic';
    default:
      return 'application/octet-stream';
  }
}

export function detectVideoExtension(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  // EBML (WebM / Matroska) — DocType usually appears in the first header bytes.
  if (
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  ) {
    const head = asciiAt(bytes, 0, Math.min(bytes.length, 64)).toLowerCase();
    return head.includes('webm') ? 'webm' : 'mkv';
  }
  if (asciiAt(bytes, 4, 4) === 'ftyp') {
    const brand = asciiAt(bytes, 8, 4);
    if (brand === 'qt  ') return 'mov';
    return 'mp4';
  }
  return null;
}

export function contentTypeForVideoExt(ext: string): string {
  switch (ext) {
    case 'mp4':
      return 'video/mp4';
    case 'mov':
      return 'video/quicktime';
    case 'webm':
      return 'video/webm';
    case 'mkv':
      return 'video/x-matroska';
    default:
      return 'application/octet-stream';
  }
}

export function detectAudioExtension(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  if (asciiAt(bytes, 0, 4) === 'RIFF' && asciiAt(bytes, 8, 4) === 'WAVE') {
    return 'wav';
  }
  // ID3 tag or MPEG frame sync
  if (asciiAt(bytes, 0, 3) === 'ID3') return 'mp3';
  if (bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0) return 'mp3';
  return null;
}

export function contentTypeForAudioExt(ext: string): string {
  switch (ext) {
    case 'wav':
      return 'audio/wav';
    case 'mp3':
      return 'audio/mpeg';
    default:
      return 'application/octet-stream';
  }
}

export class UploadBodyTooLargeError extends Error {
  constructor() {
    super('Upload too large');
    this.name = 'UploadBodyTooLargeError';
  }
}
/** Count the actual stream before multipart allocation, including unrelated fields. */
export async function readLimitedFormData(
  request: Request,
  maxBytes: number
): Promise<FormData> {
  if (contentLengthExceeds(request, maxBytes)) {
    void request.body?.cancel().catch(() => {});
    throw new UploadBodyTooLargeError();
  }
  if (!request.body) return request.formData();
  const reader = request.body.getReader();
  let total = 0;
  let exceeded = false;
  let stopped = false;
  let output: ReadableStreamDefaultController<Uint8Array>;
  const onAbort = () => {
    if (stopped) return;
    stopped = true;
    const error = new Error('Upload canceled');
    output.error(error);
    void reader.cancel(error).catch(() => {});
  };
  const body = new ReadableStream<Uint8Array>(
    {
      start(stream) {
        output = stream;
        request.signal?.addEventListener('abort', onAbort, { once: true });
        if (request.signal?.aborted) onAbort();
      },
      async pull(stream) {
        try {
          const chunk = await reader.read();
          if (stopped) return;
          if (chunk.done) {
            stopped = true;
            stream.close();
            return;
          }
          total += chunk.value.byteLength;
          if (total > maxBytes) {
            exceeded = true;
            stopped = true;
            const error = new UploadBodyTooLargeError();
            stream.error(error);
            void reader.cancel(error).catch(() => {});
            return;
          }
          stream.enqueue(chunk.value);
        } catch (error) {
          stopped = true;
          stream.error(error);
        }
      },
      cancel(reason) {
        stopped = true;
        void reader.cancel(reason).catch(() => {});
      },
    },
    { highWaterMark: 0 }
  );
  try {
    // Response uses the runtime's own multipart parser; field names/File behavior
    // remain identical and no second full-body buffering is introduced.
    return await new Response(body, {
      headers: { 'content-type': request.headers.get('content-type') || '' },
    }).formData();
  } catch (error) {
    if (exceeded) throw new UploadBodyTooLargeError();
    throw error;
  } finally {
    request.signal?.removeEventListener('abort', onAbort);
    if (!stopped) void reader.cancel().catch(() => {});
  }
}
