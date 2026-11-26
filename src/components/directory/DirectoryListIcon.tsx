import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

const FALLBACK_SRC = '/directory-icon-fallback.svg';

/** 40×40 list thumb: uploaded/favicon URL, or static SVG when missing/broken. */
export function DirectoryListIcon({
  src,
  alt,
  className,
  size = 40,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  size?: number;
}) {
  const [broken, setBroken] = useState(false);
  // Row reuse / icon update after a failed favicon must retry the new src.
  useEffect(() => {
    setBroken(false);
  }, [src]);
  const showSrc = !!src?.trim() && !broken;

  return (
    <div
      className={cn(
        'border-border/60 bg-secondary/50 shrink-0 overflow-hidden rounded-lg border',
        className
      )}
      style={{ width: size, height: size }}
    >
      <img
        src={showSrc ? src!.trim() : FALLBACK_SRC}
        alt={alt}
        className="size-full object-cover"
        onError={() => {
          if (!broken) setBroken(true);
        }}
      />
    </div>
  );
}
