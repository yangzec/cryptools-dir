'use client';

import { cn } from '@/lib/utils';
import { AppLogo } from '@/components/app-logo';
import { AppName } from '@/components/app-name';

export { AppLogo } from '@/components/app-logo';
export { AppName } from '@/components/app-name';

/**
 * SiteBrand component: combines AppLogo and AppName.
 */
export function SiteBrand({
  className,
  logoClassName,
  nameClassName,
  showName = true,
  logoSize = 28,
  logoSrc,
  logoAlt,
  nameReplaceClassName,
  appName,
}: {
  className?: string;
  logoClassName?: string;
  nameClassName?: string;
  showName?: boolean;
  logoSize?: number;
  logoSrc?: string;
  logoAlt?: string;
  nameReplaceClassName?: boolean;
  appName?: React.ReactNode;
}) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2', className)}>
      <AppLogo
        className={logoClassName}
        size={logoSize}
        src={logoSrc}
        alt={logoAlt}
      />
      {showName && (
        <AppName
          className={nameClassName}
          replaceClassName={nameReplaceClassName}
        >
          {appName}
        </AppName>
      )}
    </span>
  );
}
