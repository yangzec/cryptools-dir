import { m } from '@/paraglide/messages.js';

type UploadErrPayload = {
  name?: string;
  max?: number | string;
  maxMB?: number | string;
  count?: number | string;
  size?: number | string;
  limit?: number | string;
  status?: number | string;
  detail?: string;
};

/**
 * Map stable upload API error codes (and optional payload) to localized copy.
 * Unknown codes fall back to a generic failure message.
 */
export function describeUploadError(
  codeOrMessage?: string | null,
  data?: UploadErrPayload | null
): string {
  const code = (codeOrMessage || '').trim();
  const params = {
    name: data?.name || '',
    max: String(data?.max ?? data?.maxMB ?? ''),
    count: String(data?.count ?? ''),
    size: String(data?.size ?? ''),
    limit: String(data?.limit ?? ''),
    status: String(data?.status ?? ''),
    detail: data?.detail || code,
  };

  const table: Record<string, () => string> = {
    'common.upload.unauthorized': () => m['common.upload.unauthorized'](),
    unauthorized: () => m['common.upload.unauthorized'](),
    'common.upload.payload_too_large': () =>
      m['common.upload.payload_too_large'](),
    'common.upload.no_files': () => m['common.upload.no_files'](),
    'common.upload.too_many_files': () =>
      m['common.upload.too_many_files']({ max: params.max || '10' }),
    'common.upload.unsupported_type': () =>
      m['common.upload.unsupported_type']({ name: params.name }),
    'common.upload.file_too_large_server': () =>
      m['common.upload.file_too_large_server']({
        name: params.name,
        max: params.max || '10',
      }),
    'common.upload.storage_not_configured': () =>
      m['common.upload.storage_not_configured'](),
    'common.upload.inline_too_large': () =>
      m['common.upload.inline_too_large']({
        size: params.size,
        limit: params.limit,
      }),
    'common.upload.failed': () =>
      params.detail && params.detail !== 'common.upload.failed'
        ? m['common.upload.failed_detail']({ detail: params.detail })
        : m['common.upload.failed'](),
    'common.upload.http_failed': () =>
      m['common.upload.http_failed']({ status: params.status || '?' }),
  };

  const fn = table[code];
  if (fn) return fn();

  // Legacy English server strings → still show something readable.
  if (code) {
    return m['common.upload.failed_detail']({ detail: code });
  }
  return m['common.upload.failed']();
}
