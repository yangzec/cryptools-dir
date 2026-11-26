import { createFileRoute } from '@tanstack/react-router';

import { envConfigs } from '@/config';
import { baseLocale } from '@/paraglide/runtime.js';
import { getLocalPosts, mergePosts } from '@/content/posts';

const STATIC_PAGES: { path: string; title: string; description: string }[] = [
  {
    path: '',
    title: 'Home',
    description: 'Discover hand-picked AI tools by category and use case',
  },
  {
    path: '/tools',
    title: 'All AI Tools',
    description: 'Browse every tool in the directory',
  },
  {
    path: '/categories',
    title: 'Categories',
    description: 'AI tools organized by category',
  },
  {
    path: '/tags',
    title: 'Tags',
    description: 'AI tools by use case and topic',
  },
  {
    path: '/collections',
    title: 'Collections',
    description: 'Curated lists of AI tools',
  },
  {
    path: '/submit',
    title: 'Submit a tool',
    description:
      'Free review queue or premium instant listing with 30-day featured placement and dofollow link',
  },
  {
    path: '/advertise',
    title: 'Advertise',
    description:
      'Monthly sponsor placements with limited spots (Silver / Gold / Platinum)',
  },
  { path: '/pricing', title: 'Pricing', description: 'Pricing plans' },
  { path: '/blog', title: 'Blog', description: 'Blog posts and articles' },
];

export const Route = createFileRoute('/llms.txt')({
  server: {
    handlers: {
      GET: async () => {
        const { app_url, app_name, app_description } = envConfigs;

        let posts = getLocalPosts(baseLocale);
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
          posts = mergePosts(dbPosts, posts);
        } catch {
          // Database unreachable — local posts still listed.
        }

        const lines: string[] = [
          `# ${app_name}`,
          '',
          `> ${app_description}`,
          '',
          '## Monetization',
          '',
          '- Premium tool submit: one-time fee, instant publish, 30-day featured, dofollow outbound link (prices in code: src/config/pricing.ts).',
          '- Sponsor ads: monthly subscription with limited spots; auto-renews until canceled in Billing; webhook confirms payment; refund auto-delists.',
          '',
          '## Pages',
          '',
          ...STATIC_PAGES.map(
            (p) => `- [${p.title}](${app_url}${p.path}): ${p.description}`
          ),
        ];

        // Surface directory entities for AI crawlers / GEO.
        try {
          const {
            getDirectoryCategories,
            getDirectoryCollections,
            getDirectoryTools,
          } = await import('@/modules/directory/service');
          const [categories, collections, toolsPage] = await Promise.all([
            getDirectoryCategories(baseLocale).catch(() => []),
            getDirectoryCollections(baseLocale).catch(() => []),
            getDirectoryTools({
              locale: baseLocale,
              page: 1,
              pageSize: 100,
              sort: 'recommended',
            }).catch(() => ({ items: [] as any[] })),
          ]);

          if (categories.length > 0) {
            lines.push('', '## Categories', '');
            for (const c of categories.slice(0, 40)) {
              lines.push(
                `- [${c.name}](${app_url}/categories/${c.slug}): ${c.description || c.name}`
              );
            }
          }
          if (collections.length > 0) {
            lines.push('', '## Collections', '');
            for (const c of collections.slice(0, 40)) {
              lines.push(
                `- [${c.name}](${app_url}/collections/${c.slug}): ${c.description || c.name}`
              );
            }
          }
          if (toolsPage.items.length > 0) {
            lines.push('', '## Featured & popular tools', '');
            for (const t of toolsPage.items.slice(0, 80)) {
              lines.push(
                `- [${t.name}](${app_url}/tools/${t.slug}): ${t.tagline || t.name}`
              );
            }
          }
        } catch {
          // Directory unavailable.
        }

        if (posts.length > 0) {
          lines.push('', '## Blog Posts', '');
          for (const post of posts) {
            lines.push(
              `- [${post.title}](${app_url}/blog/${post.slug}): ${post.description}`
            );
          }
        }

        lines.push('');

        return new Response(lines.join('\n'), {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      },
    },
  },
});
