'use client';

import { useEffect, useState } from 'react';

import { envConfigs } from '@/config';
import { cn } from '@/lib/utils';
import { usePublicConfig } from '@/hooks/use-public-config';

/**
 * AppLogo component: renders the brand logo.
 * Priority: Admin DB config `app_logo` -> env `VITE_APP_LOGO` -> fallback to `/logo.svg`.
 */
export function AppLogo({
  className,
  size = 28,
  src,
  alt: customAlt,
}: {
  className?: string;
  size?: number;
  src?: string;
  alt?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const { data: configsData } = usePublicConfig();

  useEffect(() => {
    setMounted(true);
  }, []);

  const logo =
    src ||
    (mounted && configsData?.app_logo?.trim()) ||
    envConfigs.app_logo ||
    '/logo.svg';
  const alt =
    customAlt ||
    (mounted && configsData?.app_name?.trim()) ||
    envConfigs.app_name ||
    'App Logo';

  return (
    <img
      src={logo}
      alt={alt}
      width={size}
      height={size}
      className={cn('size-7 shrink-0 rounded-md object-contain', className)}
      suppressHydrationWarning
    />
  );
}
