import { describeUploadError } from '@/lib/upload-errors';
import { m } from '@/paraglide/messages.js';

export type UploadStatus = 'idle' | 'uploading' | 'uploaded' | 'error';

export interface ImageUploaderValue {
  id: string;
  preview: string;
  url?: string;
  status: UploadStatus;
  size?: number;
}

export interface ImageUploaderProps {
  allowMultiple?: boolean;
  maxImages?: number;
  maxSizeMB?: number;
  title?: string;
  emptyHint?: string;
  className?: string;
  defaultPreviews?: string[];
  onChange?: (items: ImageUploaderValue[]) => void;
}

export interface UploadItem extends ImageUploaderValue {
  file?: File;
  uploadKey?: string;
}

export const formatBytes = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(2)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
};

export const uploadImageFile = async (file: File) => {
  const formData = new FormData();
  formData.append('files', file);

  const response = await fetch('/api/storage/upload-image', {
    method: 'POST',
    body: formData,
  });

  let result: any = null;
  try {
    result = await response.json();
  } catch {
    result = null;
  }

  if (!response.ok) {
    throw new Error(
      describeUploadError(
        result?.message || 'common.upload.http_failed',
        result?.data || { status: response.status }
      )
    );
  }

  if (result?.code !== 0 || !result?.data?.urls?.length) {
    throw new Error(
      describeUploadError(
        result?.message || 'common.upload.failed',
        result?.data
      )
    );
  }

  return result.data.urls[0] as string;
};

export function toastUploadFailure(error: unknown) {
  const message =
    error instanceof Error && error.message
      ? error.message
      : m['common.upload.failed']();
  return message;
}
