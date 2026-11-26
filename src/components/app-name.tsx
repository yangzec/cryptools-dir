'use client';

import { useEffect, useState } from 'react';

import { envConfigs } from '@/config';
import { cn } from '@/lib/utils';
import { usePublicConfig } from '@/hooks/use-public-config';

/**
 * AppName component: renders the brand application name.
 * Priority: Admin DB config `app_name` -> env `VITE_APP_NAME` -> fallback to 'ShipAny Dir'.
 */
export function AppName({
  className,
  replaceClassName = false,
  children,
}: {
  className?: string;
  replaceClassName?: boolean;
  children?: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const { data: configsData } = usePublicConfig();

  useEffect(() => {
    setMounted(true);
  }, []);

  const appName =
    children ||
    (mounted && configsData?.app_name?.trim()) ||
    envConfigs.app_name ||
    'ShipAny Dir';

  return (
    <span
      suppressHydrationWarning
      className={
        replaceClassName
          ? className
          : cn(
              'text-foreground [[data-sidebar]_&]:text-sidebar-foreground truncate text-base font-semibold tracking-tight',
              className
            )
      }
    >
      {appName}
    </span>
  );
}
