'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/utils';
import { ImageUploaderGrid } from '@/components/image-uploader-grid';
import {
  type ImageUploaderProps,
  type ImageUploaderValue,
  type UploadItem,
  type UploadStatus,
} from '@/components/image-uploader-types';
import { handleUploadFiles } from '@/components/image-uploader-upload';

export type { ImageUploaderValue, UploadStatus };

export function ImageUploader({
  allowMultiple = false,
  maxImages = 1,
  maxSizeMB = 10,
  title,
  emptyHint,
  className,
  defaultPreviews,
  onChange,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isInitializedRef = useRef(false);
  const onChangeRef = useRef(onChange);
  const isInternalChangeRef = useRef(false);
  const replaceTargetIdRef = useRef<string | null>(null);
  const dragCounterRef = useRef(0);
  const [isDragActive, setIsDragActive] = useState(false);

  const [items, setItems] = useState<UploadItem[]>(() => {
    if (defaultPreviews?.length) {
      return defaultPreviews.map((url, index) => ({
        id: `preset-${url}-${index}`,
        preview: url,
        url,
        status: 'uploaded' as UploadStatus,
      }));
    }
    return [];
  });

  const maxCount = allowMultiple ? maxImages : 1;
  const maxBytes = maxSizeMB * 1024 * 1024;

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!isInitializedRef.current) return;
    if (isInternalChangeRef.current) {
      isInternalChangeRef.current = false;
      return;
    }

    const defaultUrls = defaultPreviews || [];

    setItems((currentItems) => {
      const currentUrls = currentItems
        .filter((item) => item.status === 'uploaded' && item.url)
        .map((item) => item.url as string);

      const isSame =
        defaultUrls.length === currentUrls.length &&
        defaultUrls.every((url, index) => url === currentUrls[index]);

      if (!isSame) {
        return defaultUrls.map((url, index) => ({
          id: `preset-${url}-${index}`,
          preview: url,
          url,
          status: 'uploaded' as UploadStatus,
        }));
      }

      return currentItems;
    });
  }, [defaultPreviews]);

  useEffect(() => {
    return () => {
      items.forEach((item) => {
        if (item.preview.startsWith('blob:')) {
          URL.revokeObjectURL(item.preview);
        }
      });
    };
  }, [items]);

  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      return;
    }

    isInternalChangeRef.current = true;

    onChangeRef.current?.(
      items.map(({ id, preview, url, status, size }) => ({
        id,
        preview,
        url,
        status,
        size,
      }))
    );
  }, [items]);

  const handleFiles = (selectedFiles: File[]) => {
    handleUploadFiles({
      selectedFiles,
      items,
      maxCount,
      maxBytes,
      maxSizeMB,
      replaceTargetIdRef,
      inputRef,
      setItems,
    });
  };

  const handleSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (!selectedFiles.length) return;
    handleFiles(selectedFiles);
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const clipboardItems = Array.from(event.clipboardData?.items || []);
    const files = clipboardItems
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter(Boolean) as File[];

    if (!files.length) return;
    event.preventDefault();
    handleFiles(files);
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current += 1;
    setIsDragActive(true);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
    if (!isDragActive) setIsDragActive(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragActive(false);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragActive(false);

    const files = Array.from(event.dataTransfer?.files || []).filter((file) =>
      file.type?.startsWith('image/')
    );
    if (!files.length) return;
    handleFiles(files);
  };

  const handleRemove = (id: string) => {
    setItems((prev) => {
      const next = prev.filter((item) => item.id !== id);
      const removed = prev.find((item) => item.id === id);
      if (removed?.preview.startsWith('blob:')) {
        URL.revokeObjectURL(removed.preview);
      }
      return next;
    });
  };

  const openFilePicker = () => {
    inputRef.current?.click();
  };

  const openReplacePicker = (id: string) => {
    replaceTargetIdRef.current = id;
    openFilePicker();
  };

  const countLabel = useMemo(
    () => `${items.length}/${maxCount}`,
    [items.length, maxCount]
  );

  return (
    <div
      className={cn(
        'relative focus:outline-none',
        isDragActive &&
          'ring-primary/70 ring-offset-background ring-2 ring-offset-2',
        className
      )}
      tabIndex={0}
      onPaste={handlePaste}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragActive && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/10 backdrop-blur-sm">
          <div className="bg-background/80 text-foreground rounded-full px-4 py-2 text-sm font-medium shadow-sm">
            Drop to upload
          </div>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={allowMultiple}
        onChange={handleSelect}
        className="hidden"
      />

      <ImageUploaderGrid
        title={title}
        emptyHint={emptyHint}
        countLabel={countLabel}
        items={items}
        maxCount={maxCount}
        maxSizeMB={maxSizeMB}
        allowMultiple={allowMultiple}
        onReplace={openReplacePicker}
        onRemove={handleRemove}
        onOpenPicker={openFilePicker}
      />
    </div>
  );
}
