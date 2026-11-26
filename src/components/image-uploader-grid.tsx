import { ImageIcon, RefreshCw, Upload, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import {
  formatBytes,
  type UploadItem,
} from '@/components/image-uploader-types';
import { Button } from '@/components/ui/button';

export function ImageUploaderGrid({
  title,
  emptyHint,
  countLabel,
  items,
  maxCount,
  maxSizeMB,
  allowMultiple,
  onReplace,
  onRemove,
  onOpenPicker,
}: {
  title?: string;
  emptyHint?: string;
  countLabel: string;
  items: UploadItem[];
  maxCount: number;
  maxSizeMB: number;
  allowMultiple: boolean;
  onReplace: (id: string) => void;
  onRemove: (id: string) => void;
  onOpenPicker: () => void;
}) {
  return (
    <>
      {title && (
        <div className="text-foreground mb-2 flex items-center justify-between text-sm font-medium">
          <div className="flex items-center gap-2">
            <ImageIcon className="text-primary h-4 w-4" />
            <span>{title}</span>
            <span className="text-primary text-xs">({countLabel})</span>
          </div>
        </div>
      )}

      <div
        className={cn(
          'flex flex-wrap gap-4',
          allowMultiple ? 'flex-wrap' : 'flex-nowrap'
        )}
      >
        {items.map((item) => (
          <div
            key={item.id}
            className="group border-border bg-muted/50 hover:border-border hover:bg-muted relative overflow-hidden rounded-xl border p-1 shadow-sm transition"
          >
            <div className="relative overflow-hidden rounded-lg">
              <img
                src={item.preview}
                alt="Preview"
                className="h-32 w-32 rounded-lg object-cover"
              />
              {item.size && (
                <span className="bg-background text-muted-foreground absolute bottom-2 left-2 rounded-md px-2 py-1 text-[10px] font-medium">
                  {formatBytes(item.size)}
                </span>
              )}
              {item.status !== 'uploading' && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/35 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="bg-background/50 text-foreground hover:bg-background/50 h-10 w-10 rounded-full shadow-sm backdrop-blur focus-visible:ring-2 focus-visible:ring-white/70"
                    onClick={() => onReplace(item.id)}
                    aria-label="Replace image"
                  >
                    <RefreshCw className="h-5 w-5" />
                  </Button>
                </div>
              )}
              {item.status === 'uploading' && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 text-xs font-medium text-white">
                  Uploading...
                </div>
              )}
              {item.status === 'error' && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-red-500/70 text-xs font-medium text-white">
                  Failed
                </div>
              )}
              <Button
                type="button"
                size="icon"
                variant="destructive"
                className="absolute top-2 right-2 z-20 h-7 w-7"
                onClick={() => onRemove(item.id)}
                aria-label="Remove image"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}

        {items.length < maxCount && (
          <div className="group border-border bg-muted/50 hover:border-border hover:bg-muted relative overflow-hidden rounded-xl border border-dashed p-1 shadow-sm transition">
            <div className="relative overflow-hidden rounded-lg">
              <button
                type="button"
                className="flex h-32 w-32 flex-col items-center justify-center gap-2"
                onClick={onOpenPicker}
              >
                <div className="border-border flex h-10 w-10 items-center justify-center rounded-full border border-dashed">
                  <Upload className="h-5 w-5" />
                </div>
                <span className="text-xs font-medium">
                  {m['common.upload.label']()}
                </span>
                <span className="text-primary text-xs">
                  {m['common.upload.max_mb']({ max: String(maxSizeMB) })}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {!title && emptyHint && (
        <div className="text-muted-foreground mt-2 text-xs">{emptyHint}</div>
      )}
    </>
  );
}
