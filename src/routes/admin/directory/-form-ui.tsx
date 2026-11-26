import { useMemo, useState, type ReactNode } from 'react';

import { localeNames } from '@/config/locale';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import {
  ImageUploader,
  type ImageUploaderValue,
} from '@/components/image-uploader';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

export type DirectoryFormLocale = 'en' | 'zh';

export const DIRECTORY_FORM_LOCALES: DirectoryFormLocale[] = ['en', 'zh'];

/** Map a logical i18n field to the form field name for the active locale. */
export function localeField<T extends string>(
  base: T,
  locale: DirectoryFormLocale
): T | `${T}Zh` {
  return locale === 'en' ? base : (`${base}Zh` as `${T}Zh`);
}

/**
 * Side drawer for directory create / edit / management panels.
 * Wider than the default Sheet so forms stay readable; sticky header + scroll body.
 */
export function DirectoryFormDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          // Override Sheet default data-[side=*]:sm:max-w-sm (384px).
          // Desktop ~672px (max-w-2xl); mobile stays full width.
          'flex w-full flex-col gap-0 p-0',
          'data-[side=left]:w-full data-[side=right]:w-full',
          'data-[side=left]:sm:max-w-2xl data-[side=right]:sm:max-w-2xl',
          className
        )}
      >
        <SheetHeader className="shrink-0 space-y-1 border-b px-6 py-4 pr-12 text-left">
          <SheetTitle>{title}</SheetTitle>
          {description ? (
            <SheetDescription>{description}</SheetDescription>
          ) : (
            <SheetDescription className="sr-only">{title}</SheetDescription>
          )}
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Two compact fields per row on sm+; stacks on mobile. */
export function DirectoryFormRow({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
  );
}

/** Scrollable field area + sticky cancel/save footer inside a drawer form. */
export function DirectoryFormBody({
  children,
  actions,
}: {
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
        {children}
      </div>
      <div className="bg-background shrink-0 border-t px-6 py-4">
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {actions}
        </div>
      </div>
    </>
  );
}

/**
 * Locale segmented control + one field set at a time.
 * Shared (non-i18n) fields stay outside this section.
 * Adding a locale later only needs DIRECTORY_FORM_LOCALES + field-name mapping.
 */
export function DirectoryLocaleSection({
  children,
}: {
  children: (locale: DirectoryFormLocale) => ReactNode;
}) {
  const [locale, setLocale] = useState<DirectoryFormLocale>('en');

  return (
    <div className="bg-muted/20 space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs font-medium">
          {m['admin.directory.common.content_locale']()}
        </p>
        <div
          role="tablist"
          aria-label={m['admin.directory.common.content_locale']()}
          className="bg-muted inline-flex h-8 items-center rounded-lg p-[3px]"
        >
          {DIRECTORY_FORM_LOCALES.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={locale === id}
              className={cn(
                'inline-flex h-[calc(100%-1px)] items-center justify-center rounded-md px-3 text-sm font-medium transition-all',
                locale === id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-foreground/60 hover:text-foreground'
              )}
              onClick={() => setLocale(id)}
            >
              {localeNames[id] ?? id}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-4">{children(locale)}</div>
      {locale !== 'en' ? (
        <p className="text-muted-foreground text-xs">
          {m['admin.directory.common.locale_optional_hint']()}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Single-image upload for directory admin (icon / cover).
 * Remounts when `value` identity changes so ImageUploader's useState initializer
 * picks up an existing URL after async editForm.reset (可靠回显).
 * `key` stays stable during an in-flight upload because we only write the form
 * value once status === 'uploaded'.
 */
export function DirectoryImageField({
  label,
  value,
  onChange,
  maxSizeMB = 2,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  maxSizeMB?: number;
}) {
  const previews = useMemo(() => (value ? [value] : []), [value]);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <ImageUploader
        key={value || '__empty__'}
        maxSizeMB={maxSizeMB}
        defaultPreviews={previews}
        onChange={(items: ImageUploaderValue[]) => {
          const uploaded = items.find(
            (item) => item.status === 'uploaded' && item.url
          );
          if (uploaded?.url) {
            onChange(uploaded.url);
            return;
          }
          // Keep current value while upload is in flight; clear only when empty.
          const busy = items.some((item) => item.status === 'uploading');
          if (!busy && items.length === 0) onChange('');
        }}
      />
    </div>
  );
}
