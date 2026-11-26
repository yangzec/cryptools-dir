import { m } from '@/paraglide/messages.js';

export interface ToolItem {
  id: string;
  slug: string;
  name: string;
  taglineKey: string;
  iconUrl: string;
  websiteUrl: string;
  pricing?: string;
  categorySlug: string;
  categoryNameKey: string;
  featured?: boolean;
  sponsored?: boolean;
}

export interface CategoryItem {
  id: string;
  slug: string;
  nameKey: string;
  descKey: string;
  icon: string;
  sort: number;
  projectCount: number;
}

export interface TagItem {
  name: string;
  slug: string;
  nameKey?: string;
}

export interface FAQItem {
  questionKey: string;
  answerKey: string;
}

export function tr(key: string, params?: Record<string, any>): string {
  if (!key) return '';
  const fn = (m as any)[key];
  if (typeof fn === 'function') {
    return fn(params);
  }
  return key;
}
