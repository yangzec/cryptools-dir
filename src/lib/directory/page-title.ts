import { m } from '@/paraglide/messages.js';

type Locale = string;

function brand(locale: Locale) {
  return m['directory.brand_name']({}, { locale: locale as any });
}

/** Home: `ShipAny Dir — Discover the best AI tools` */
export function directoryHomeTitle(locale: Locale) {
  return m['directory.meta.home'](
    {
      brand: brand(locale),
      title: m['directory.title']({}, { locale: locale as any }),
    },
    { locale: locale as any }
  );
}

/** Tools index with total count */
export function directoryToolsTitle(locale: Locale, count: number) {
  return m['directory.meta.tools'](
    { count, brand: brand(locale) },
    { locale: locale as any }
  );
}

export function directoryCategoriesTitle(locale: Locale, count: number) {
  return m['directory.meta.categories'](
    { count, brand: brand(locale) },
    { locale: locale as any }
  );
}

export function directoryCollectionsTitle(locale: Locale, count = 0) {
  return m['directory.meta.collections'](
    { count, brand: brand(locale) },
    { locale: locale as any }
  );
}

export function directoryTagsTitle(locale: Locale, count: number) {
  return m['directory.meta.tags'](
    { count, brand: brand(locale) },
    { locale: locale as any }
  );
}

export function directoryFeedTitle(locale: Locale) {
  return m['directory.meta.feed'](
    { brand: brand(locale) },
    { locale: locale as any }
  );
}

export function directoryToolDetailTitle(locale: Locale, name: string) {
  return m['directory.meta.tool_detail'](
    { name, brand: brand(locale) },
    { locale: locale as any }
  );
}

export function directoryBlogTitle(locale: Locale) {
  return m['directory.meta.blog'](
    { brand: brand(locale) },
    { locale: locale as any }
  );
}

/** Generic `Title | ShipAny Dir` */
export function withDirectoryBrand(locale: Locale, title: string) {
  return m['directory.meta.with_brand'](
    { title, brand: brand(locale) },
    { locale: locale as any }
  );
}
