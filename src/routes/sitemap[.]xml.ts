import { createFileRoute } from '@tanstack/react-router';

import { envConfigs } from '@/config';
import { baseLocale, locales, localizeUrl } from '@/paraglide/runtime.js';
import { getLocalPosts, mergePosts } from '@/content/posts';

const STATIC_PATHS = [
  '',
  '/tools',
  '/categories',
  '/tags',
  '/collections',
  '/submit',
  '/advertise',
  '/pricing',
  '/blog',
  '/privacy-policy',
  '/terms-of-service',
];

type Entry = {
  path: string;
  lastModified?: string;
  changeFrequency: string;
  priority: number;
};

function urlFor(path: string, locale: string): string {
  return localizeUrl(`${envConfigs.app_url}${path || '/'}`, {
    locale: locale as (typeof locales)[number],
  }).href;
}

function entryXml(e: Entry): string {
  const alternates = locales
    .map(
      (loc) =>
        `    <xhtml:link rel="alternate" hreflang="${loc}" href="${urlFor(e.path, loc)}"/>`
    )
    .join('\n');
  return [
    '  <url>',
    `    <loc>${urlFor(e.path, baseLocale)}</loc>`,
    alternates,
    e.lastModified ? `    <lastmod>${e.lastModified}</lastmod>` : null,
    `    <changefreq>${e.changeFrequency}</changefreq>`,
    `    <priority>${e.priority}</priority>`,
    '  </url>',
  ]
    .filter(Boolean)
    .join('\n');
}

function isoDay(value: Date | string | null | undefined) {
  if (!value) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10);
}

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: async () => {
        const entries: Entry[] = STATIC_PATHS.map((path) => ({
          path,
          changeFrequency:
            path === '/blog' || path === '/tools' || path === ''
              ? 'daily'
              : 'weekly',
          priority:
            path === '' ? 1 : path === '/tools' || path === '/blog' ? 0.9 : 0.8,
        }));

        // Directory entities for search ranking.
        try {
          const {
            getDirectoryCategories,
            getDirectoryTags,
            getDirectoryCollections,
            getDirectoryTools,
          } = await import('@/modules/directory/service');

          const [categories, tags, collections, toolsPage] = await Promise.all([
            getDirectoryCategories(baseLocale).catch(() => []),
            getDirectoryTags(baseLocale).catch(() => []),
            getDirectoryCollections(baseLocale).catch(() => []),
            getDirectoryTools({
              locale: baseLocale,
              page: 1,
              pageSize: 500,
              sort: 'latest',
            }).catch(() => ({ items: [] as any[] })),
          ]);

          for (const c of categories) {
            entries.push({
              path: `/categories/${c.slug}`,
              changeFrequency: 'weekly',
              priority: 0.7,
            });
          }
          for (const t of tags) {
            entries.push({
              path: `/tags/${t.slug}`,
              changeFrequency: 'weekly',
              priority: 0.65,
            });
          }
          for (const c of collections) {
            entries.push({
              path: `/collections/${c.slug}`,
              changeFrequency: 'weekly',
              priority: 0.7,
            });
          }
          for (const tool of toolsPage.items) {
            entries.push({
              path: `/tools/${tool.slug}`,
              lastModified: isoDay(tool.publishedAt || tool.createdAt),
              changeFrequency: 'weekly',
              priority: tool.featured ? 0.85 : 0.75,
            });
          }
        } catch {
          // Directory DB unreachable — static + blog still listed.
        }

        // Blog posts: db posts merged with local MDX posts.
        try {
          const { listPublishedArticles } =
            await import('@/modules/posts/service');
          const rows = await listPublishedArticles().catch(() => []);
          const dbPosts = rows.map((row) => ({
            slug: row.slug,
            title: row.title || row.slug,
            description: row.description || '',
            createdAt: new Date(row.createdAt).toISOString(),
            source: 'db' as const,
          }));
          const posts = mergePosts(dbPosts, getLocalPosts(baseLocale));
          for (const post of posts) {
            entries.push({
              path: `/blog/${post.slug}`,
              lastModified: post.createdAt,
              changeFrequency: 'monthly',
              priority: 0.6,
            });
          }
        } catch {
          for (const post of getLocalPosts(baseLocale)) {
            entries.push({
              path: `/blog/${post.slug}`,
              lastModified: post.createdAt,
              changeFrequency: 'monthly',
              priority: 0.6,
            });
          }
        }

        const xml = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
          ...entries.map(entryXml),
          '</urlset>',
          '',
        ].join('\n');

        return new Response(xml, {
          headers: { 'Content-Type': 'application/xml' },
        });
      },
    },
  },
});
