import { z } from 'zod';

export interface Post {
  id: string;
  slug: string;
  type: string;
  title: string;
  description: string | null;
  image: string | null;
  categories: string | null;
  authorName: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryOption {
  id: string;
  title: string;
  slug: string;
}

export const PAGE_SIZE = 20;
export const TABS = ['all', 'published', 'draft'] as const;
export type Tab = (typeof TABS)[number];

export const postSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  content: z.string(),
  categories: z.string(),
  authorName: z.string(),
  status: z.string(),
});
export type PostForm = z.infer<typeof postSchema>;
export const emptyForm: PostForm = {
  slug: '',
  title: '',
  description: '',
  content: '',
  categories: '',
  authorName: '',
  status: 'draft',
};
