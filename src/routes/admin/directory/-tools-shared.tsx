import { z } from 'zod';

export type Tab =
  'all' | 'published' | 'pending' | 'pending_payment' | 'rejected';
export const TABS: Tab[] = [
  'all',
  'published',
  'pending',
  'pending_payment',
  'rejected',
];

export interface DirTool {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  iconUrl: string;
  websiteUrl: string;
  pricing: string;
  authorName: string;
  categoryId: string | null;
  categoryName: string;
  source: string;
  featured: boolean;
  sponsored: boolean;
  sort: number;
  status: string;
  createdAt: string;
}

export interface Option {
  id: string;
  slug: string;
  name: string;
}

export const PAGE_SIZE = 20;
export const schema = z.object({
  slug: z.string(),
  name: z.string().min(1),
  tagline: z.string(),
  introduction: z.string(),
  nameZh: z.string(),
  taglineZh: z.string(),
  introductionZh: z.string(),
  websiteUrl: z.string(),
  iconUrl: z.string(),
  pricing: z.string(),
  authorName: z.string(),
  categoryId: z.string(),
  source: z.string(),
  status: z.string(),
  featured: z.boolean(),
  sponsored: z.boolean(),
  sort: z.string(),
  tagIds: z.array(z.string()),
});
export type FormValues = z.infer<typeof schema>;
export const emptyForm: FormValues = {
  slug: '',
  name: '',
  tagline: '',
  introduction: '',
  nameZh: '',
  taglineZh: '',
  introductionZh: '',
  websiteUrl: '',
  iconUrl: '',
  pricing: 'free',
  authorName: '',
  categoryId: '',
  source: 'editorial',
  status: 'published',
  featured: false,
  sponsored: false,
  sort: '0',
  tagIds: [],
};

/** Map tool detail API / row into edit-form values (for defaultValues remount). */
export function valuesFromToolDetail(
  d: Omit<Partial<FormValues>, 'sort'> & {
    id?: string;
    /** Detail API returns numeric sort; form uses string. */
    sort?: string | number;
  }
): FormValues {
  return {
    slug: d.slug || '',
    name: d.name || '',
    tagline: d.tagline || '',
    introduction: d.introduction || '',
    nameZh: d.nameZh || '',
    taglineZh: d.taglineZh || '',
    introductionZh: d.introductionZh || '',
    websiteUrl: d.websiteUrl || '',
    iconUrl: d.iconUrl || '',
    pricing: d.pricing || 'free',
    authorName: d.authorName || '',
    categoryId: d.categoryId || '',
    source: d.source || 'editorial',
    status: d.status || 'published',
    featured: Boolean(d.featured),
    sponsored: Boolean(d.sponsored),
    sort: String(d.sort ?? 0),
    tagIds: d.tagIds ? [...d.tagIds] : [],
  };
}

export function toPayload(value: FormValues) {
  return {
    slug: value.slug.trim() || undefined,
    name: value.name.trim(),
    // Always send (incl. '') so clearing EN optional copy reaches the API —
    // JSON.stringify would drop `undefined` and leave stale DB values.
    tagline: value.tagline.trim(),
    introduction: value.introduction.trim(),
    nameZh: value.nameZh.trim(),
    taglineZh: value.taglineZh.trim(),
    introductionZh: value.introductionZh.trim(),
    // Always send so clearing reaches the API (empty → null / omit-undefined drop).
    websiteUrl: value.websiteUrl.trim(),
    iconUrl: value.iconUrl.trim(),
    pricing: value.pricing || 'free',
    authorName: value.authorName.trim(),
    categoryId: value.categoryId || '',
    source: value.source === 'community' ? 'community' : 'editorial',
    status: value.status || 'published',
    featured: value.featured,
    sponsored: value.sponsored,
    sort: Number(value.sort) || 0,
    tagIds: value.tagIds,
  };
}

/** Edit payload omits slug/source/status — those stay locked after create. */
export function toEditPayload(value: FormValues) {
  const full = toPayload(value);
  const { slug: _slug, source: _source, status: _status, ...rest } = full;
  return rest;
}

export function canDeleteTool(status: string) {
  return status !== 'published';
}

export function canForceUnpublishTool(status: string) {
  return status === 'published';
}
