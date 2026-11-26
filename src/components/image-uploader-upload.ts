import type {
  Dispatch,
  MutableRefObject,
  RefObject,
  SetStateAction,
} from 'react';
import { toast } from 'sonner';

import { m } from '@/paraglide/messages.js';
import {
  toastUploadFailure,
  uploadImageFile,
  type UploadItem,
  type UploadStatus,
} from '@/components/image-uploader-types';

type SetItems = Dispatch<SetStateAction<UploadItem[]>>;

export function replaceUploadItems(
  pairs: Array<{ id: string; file: File }>,
  setItems: SetItems,
  inputRef: RefObject<HTMLInputElement | null>
) {
  pairs.forEach(({ id, file }) => {
    const uploadKey = `${Date.now()}-${Math.random()}`;
    const nextPreview = URL.createObjectURL(file);

    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (item.preview.startsWith('blob:')) {
          URL.revokeObjectURL(item.preview);
        }
        return {
          ...item,
          preview: nextPreview,
          file,
          size: file.size,
          url: undefined,
          status: 'uploading' as UploadStatus,
          uploadKey,
        };
      })
    );

    uploadImageFile(file)
      .then((url) => {
        setItems((prev) =>
          prev.map((item) => {
            if (item.id !== id) return item;
            if (item.uploadKey !== uploadKey) return item;
            if (item.preview.startsWith('blob:')) {
              URL.revokeObjectURL(item.preview);
            }
            return {
              ...item,
              preview: url,
              url,
              status: 'uploaded' as UploadStatus,
              file: undefined,
            };
          })
        );
      })
      .catch((error: any) => {
        console.error('Upload failed:', error);
        toast.error(toastUploadFailure(error));
        setItems((prev) =>
          prev.map((item) => {
            if (item.id !== id) return item;
            if (item.uploadKey !== uploadKey) return item;
            return { ...item, status: 'error' as UploadStatus };
          })
        );
      })
      .finally(() => {
        if (inputRef.current) inputRef.current.value = '';
      });
  });
}

export function handleUploadFiles(options: {
  selectedFiles: File[];
  items: UploadItem[];
  maxCount: number;
  maxBytes: number;
  maxSizeMB: number;
  replaceTargetIdRef: MutableRefObject<string | null>;
  inputRef: RefObject<HTMLInputElement | null>;
  setItems: SetItems;
}) {
  const {
    selectedFiles,
    items,
    maxCount,
    maxBytes,
    maxSizeMB,
    replaceTargetIdRef,
    inputRef,
    setItems,
  } = options;

  const replaceTargetId = replaceTargetIdRef.current;
  if (replaceTargetId) {
    replaceTargetIdRef.current = null;
    const file = selectedFiles[0];
    if (!file) return;
    if (!file.type?.startsWith('image/')) {
      toast.error(m['common.upload.only_images']());
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    if (file.size > maxBytes) {
      toast.error(
        m['common.upload.exceeds_limit']({
          name: file.name,
          max: String(maxSizeMB),
        })
      );
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    replaceUploadItems([{ id: replaceTargetId, file }], setItems, inputRef);
    return;
  }

  const availableSlots = maxCount - items.length;
  const filesToAdd = selectedFiles
    .filter((file) => {
      if (!file.type?.startsWith('image/')) {
        toast.error(m['common.upload.not_image']({ name: file.name }));
        return false;
      }
      if (file.size > maxBytes) {
        toast.error(
          m['common.upload.exceeds_limit']({
            name: file.name,
            max: String(maxSizeMB),
          })
        );
        return false;
      }
      return true;
    })
    .slice(0, Math.max(availableSlots, 0));

  if (!filesToAdd.length) {
    if (items.length) {
      const normalized = selectedFiles.filter((file) =>
        file.type?.startsWith('image/')
      );
      if (!normalized.length) return;

      const k = Math.min(normalized.length, items.length);
      const tail = items.slice(-k);
      const pairs: Array<{ id: string; file: File }> = [];

      for (let i = 0; i < k; i += 1) {
        const targetId = tail[tail.length - 1 - i]?.id;
        const file = normalized[i];
        if (targetId && file) pairs.push({ id: targetId, file });
      }

      if (pairs.length) replaceUploadItems(pairs, setItems, inputRef);
    }

    if (inputRef.current) inputRef.current.value = '';
    return;
  }

  if (availableSlots < selectedFiles.length) {
    toast.message(
      m['common.upload.only_first_n']({ count: String(filesToAdd.length) })
    );
  }

  const newItems = filesToAdd.map((file) => ({
    id: `${file.name}-${file.lastModified}-${Math.random()}`,
    preview: URL.createObjectURL(file),
    file,
    size: file.size,
    status: 'uploading' as UploadStatus,
    uploadKey: `${Date.now()}-${Math.random()}`,
  }));

  setItems((prev) => [...prev, ...newItems]);

  Promise.all(
    newItems.map(async (item) => {
      try {
        const url = await uploadImageFile(item.file as File);
        setItems((prev) =>
          prev.map((current) => {
            if (current.id !== item.id) return current;
            if (
              current.uploadKey &&
              item.uploadKey &&
              current.uploadKey !== item.uploadKey
            ) {
              return current;
            }
            if (current.preview.startsWith('blob:')) {
              URL.revokeObjectURL(current.preview);
            }
            return {
              ...current,
              preview: url,
              url,
              status: 'uploaded' as UploadStatus,
              file: undefined,
            };
          })
        );
      } catch (error: any) {
        console.error('Upload failed:', error);
        toast.error(toastUploadFailure(error));
        setItems((prev) =>
          prev.map((current) => {
            if (current.id !== item.id) return current;
            if (current.uploadKey && current.uploadKey !== item.uploadKey)
              return current;
            return { ...current, status: 'error' as UploadStatus };
          })
        );
      }
    })
  );

  if (inputRef.current) inputRef.current.value = '';
}
