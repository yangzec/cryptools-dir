import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

interface ScreenshotGalleryProps {
  toolName: string;
  screenshots: string[];
  className?: string;
}

export function ScreenshotGallery({
  toolName,
  screenshots,
  className,
}: ScreenshotGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const total = screenshots.length;
  if (!screenshots || total === 0) {
    return null;
  }

  const safeIndex = Math.min(activeIndex, Math.max(0, total - 1));
  const currentScreenshot = screenshots[safeIndex];

  const handleStep = (delta: number) => {
    setActiveIndex((prev) => (prev + delta + total) % total);
  };

  const navButtons = total > 1 && (
    <>
      <button
        type="button"
        aria-label={m['directory.screenshot_prev']()}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleStep(-1);
        }}
        className="bg-background/85 hover:bg-background absolute top-1/2 left-3 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full border shadow-sm backdrop-blur transition"
      >
        <ChevronLeft className="size-4" />
      </button>
      <button
        type="button"
        aria-label={m['directory.screenshot_next']()}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleStep(1);
        }}
        className="bg-background/85 hover:bg-background absolute top-1/2 right-3 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full border shadow-sm backdrop-blur transition"
      >
        <ChevronRight className="size-4" />
      </button>
    </>
  );

  return (
    <div
      tabIndex={0}
      aria-label={`${toolName} screenshots gallery`}
      className={cn('mb-8 space-y-3 outline-none', className)}
      onKeyDown={(e) => {
        if (total <= 1) return;
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          handleStep(-1);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          handleStep(1);
        }
      }}
    >
      {/* Main Screenshot Container */}
      <div className="group border-border bg-muted relative overflow-hidden rounded-xl border">
        <button
          type="button"
          aria-label={m['directory.detail.view_full_size']()}
          onClick={() => setIsOpen(true)}
          className="block w-full cursor-zoom-in text-left focus:outline-none"
        >
          <img
            src={currentScreenshot}
            alt={`${toolName} screenshot ${safeIndex + 1}`}
            width={1440}
            height={900}
            className="aspect-[16/10] w-full object-cover object-top"
          />
        </button>

        {navButtons}

        {total > 1 && (
          <span className="bg-background/85 pointer-events-none absolute right-3 bottom-3 z-10 rounded-full border px-2 py-0.5 text-xs tabular-nums backdrop-blur">
            {safeIndex + 1} / {total}
          </span>
        )}
      </div>

      {/* Thumbnail Tabs below Screenshot */}
      {total > 1 && (
        <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
          {screenshots.map((s, idx) => {
            const isActive = idx === safeIndex;
            return (
              <button
                key={`${s}-${idx}`}
                type="button"
                aria-label={`${toolName} screenshot ${idx + 1}`}
                aria-current={isActive}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setActiveIndex(idx);
                }}
                className={cn(
                  'shrink-0 cursor-pointer overflow-hidden rounded-md border-2 transition',
                  isActive
                    ? 'border-primary'
                    : 'border-transparent opacity-60 hover:opacity-100'
                )}
              >
                <img
                  src={s}
                  alt=""
                  loading="lazy"
                  className="aspect-[16/10] w-28 object-cover object-top"
                />
              </button>
            );
          })}
        </div>
      )}

      {/* Full-size Lightbox Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-[min(1200px,95vw)] p-2 sm:max-w-[min(1200px,95vw)]">
          <DialogTitle className="sr-only">
            {`${toolName} screenshot ${safeIndex + 1}`}
          </DialogTitle>
          <div className="relative">
            <img
              src={currentScreenshot}
              alt={`${toolName} screenshot ${safeIndex + 1}`}
              className="max-h-[85vh] w-full rounded-md object-contain"
            />
            {navButtons}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
