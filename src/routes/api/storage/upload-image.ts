import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createFileRoute } from '@tanstack/react-router';

import { getAuth } from '@/core/auth';
import { envConfigs } from '@/config';
import { getStorage } from '@/modules/storage/service';
import { md5 } from '@/lib/hash';
import { enforceMinIntervalRateLimit } from '@/lib/rate-limit';
import { respData, respErr, respJson } from '@/lib/resp';
import {
  contentTypeForImageExt,
  detectImageExtension,
  readLimitedFormData,
  UploadBodyTooLargeError,
} from '@/lib/upload-guards';

// Cap for the no-storage local-disk fallback (dev). Configurable via INLINE_IMAGE_MAX_KB.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
// Per request: bounds memory (formData() buffers the whole body) and storage use.
const MAX_FILES_PER_REQUEST = 10;
const MAX_REQUEST_BYTES = 20 * 1024 * 1024;

const INLINE_MAX_BYTES =
  (Number(envConfigs.inline_image_max_kb) || 10240) * 1024;

function uploadErr(code: string, data?: Record<string, unknown>) {
  return respJson(-1, code, data);
}

async function POST({ request }: { request: Request }) {
  const limited = enforceMinIntervalRateLimit(request, {
    intervalMs: 1000,
    keyPrefix: 'upload-image',
  });
  if (limited) return limited;

  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return uploadErr('common.upload.unauthorized');

    // Per account too: one user can't sidestep the IP bucket by switching networks.
    const userLimited = enforceMinIntervalRateLimit(request, {
      intervalMs: 1000,
      keyPrefix: 'upload-image',
      extraKey: session.user.id,
    });
    if (userLimited) return userLimited;

    const formData = await readLimitedFormData(request, MAX_REQUEST_BYTES);
    const files = formData.getAll('files') as File[];
    if (!files.length) return uploadErr('common.upload.no_files');
    if (files.length > MAX_FILES_PER_REQUEST) {
      return uploadErr('common.upload.too_many_files', {
        max: MAX_FILES_PER_REQUEST,
      });
    }
    if (files.reduce((sum, f) => sum + f.size, 0) > MAX_REQUEST_BYTES) {
      return uploadErr('common.upload.payload_too_large');
    }

    const storage = await getStorage();
    const uploadResults: Array<{
      url: string;
      key: string;
      filename: string;
      deduped: boolean;
    }> = [];

    for (const file of files) {
      if (file.size > MAX_UPLOAD_BYTES) {
        return uploadErr('common.upload.file_too_large_server', {
          name: file.name,
          max: 10,
        });
      }

      const arrayBuffer = await file.arrayBuffer();
      const body = new Uint8Array(arrayBuffer);
      // Extension from magic bytes only — never from client Content-Type / filename.
      const ext = detectImageExtension(body);
      if (!ext) {
        return uploadErr('common.upload.unsupported_type', {
          name: file.name,
        });
      }
      const contentType = contentTypeForImageExt(ext);

      const digest = md5(body);
      // R2Provider prepends its own uploadPath (default `uploads`), so the object
      // key is the bare filename. The local fallback uses `public/uploads/<file>`.
      const objectKey = `${digest}.${ext}`;

      // No storage configured → persist to public/uploads and return a short
      // local URL. Avoids inlining a giant base64 data URL into DB columns (some
      // are varchar(255)). Configure R2 (admin → Storage) for production.
      if (!storage) {
        // Cloudflare Workers have no writable filesystem — fail clearly
        // instead of with an opaque fs error.
        if ((globalThis as any).__CF_ENV__) {
          return uploadErr('common.upload.storage_not_configured');
        }
        if (body.length > INLINE_MAX_BYTES) {
          const limitKb = Math.round(INLINE_MAX_BYTES / 1024);
          return uploadErr('common.upload.inline_too_large', {
            size: Math.round(body.length / 1024),
            limit: limitKb,
          });
        }
        const dir = path.join(process.cwd(), 'public', 'uploads');
        await mkdir(dir, { recursive: true });
        await writeFile(path.join(dir, objectKey), body);
        uploadResults.push({
          url: `/uploads/${objectKey}`,
          key: `uploads/${objectKey}`,
          filename: file.name,
          deduped: false,
        });
        continue;
      }

      const exists = await storage.exists({ key: objectKey });
      if (exists) {
        const publicUrl = storage.getPublicUrl({ key: objectKey });
        if (publicUrl) {
          uploadResults.push({
            url: publicUrl,
            key: objectKey,
            filename: file.name,
            deduped: true,
          });
          continue;
        }
      }

      const result = await storage.uploadFile({
        body,
        key: objectKey,
        contentType,
        disposition: 'inline',
      });

      if (!result.success || !result.url) {
        return uploadErr('common.upload.failed', {
          detail: result.error || undefined,
        });
      }

      uploadResults.push({
        url: result.url,
        key: result.key || objectKey,
        filename: file.name,
        deduped: false,
      });
    }

    return respData({
      urls: uploadResults.map((r) => r.url),
      results: uploadResults,
    });
  } catch (e: any) {
    if (e instanceof UploadBodyTooLargeError) {
      return uploadErr('common.upload.payload_too_large');
    }
    console.error('upload image failed:', e);
    return respErr('common.upload.failed');
  }
}

export const Route = createFileRoute('/api/storage/upload-image')({
  server: {
    handlers: { POST },
  },
});
