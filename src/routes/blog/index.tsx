import { createFileRoute } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';

import { Link } from '@/core/i18n/navigation';
import { envConfigs } from '@/config';
import { directoryBlogTitle } from '@/lib/directory/page-title';
import { m } from '@/paraglide/messages.js';
import { getLocale, locales, localizeUrl } from '@/paraglide/runtime.js';
import { BlogCard } from '@/components/blog-card';
import { DirectoryLayout } from '@/components/directory/DirectoryLayout';
import { formatPostDate } from '@/content/posts';
import { getBlogPostsFn, getGuestPostsOpenFn } from '@/content/posts/server';

export const Route = createFileRoute('/blog/')({
  loader: async () => {
    const locale = getLocale();
    const [posts, guestPostsOpen] = await Promise.all([
      getBlogPostsFn({ data: { locale } }),
      getGuestPostsOpenFn(),
    ]);
    return { locale, posts, guestPostsOpen };
  },
  head: ({ loaderData }) => {
    const locale = loaderData?.locale;
    const urlFor = (loc: string) =>
      localizeUrl(`${envConfigs.app_url}/blog`, { locale: loc as any }).href;
    return {
      meta: [
        {
          title: directoryBlogTitle(locale ?? 'en'),
        },
        {
          name: 'description',
          content: m['blog.description']({}, { locale: locale as any }),
        },
      ],
      links: [
        { rel: 'canonical', href: urlFor(locale ?? 'en') },
        ...locales.map((loc) => ({
          rel: 'alternate',
          hrefLang: loc,
          href: urlFor(loc),
        })),
      ],
    };
  },
  component: BlogPage,
});

function BlogPage() {
  const { locale, posts, guestPostsOpen } = Route.useLoaderData();

  return (
    <DirectoryLayout>
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">
            {m['blog.title']()}
          </h1>
          <p className="text-muted-foreground mt-3 max-w-2xl">
            {m['blog.description']()}
          </p>
          {guestPostsOpen && (
            <Link
              href="/guest-post"
              className="text-muted-foreground hover:text-foreground mt-4 inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
            >
              {m['blog.write_for_us']()}
              <ArrowRight className="size-3.5" />
            </Link>
          )}
        </div>
        {posts.length === 0 ? (
          <p className="text-muted-foreground text-center">
            {m['blog.no_posts']()}
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <BlogCard
                key={post.slug}
                href={`/blog/${post.slug}`}
                title={post.title}
                description={post.description}
                image={post.image}
                date={formatPostDate(post.createdAt, locale)}
                authorName={post.authorName}
                authorImage={post.authorImage}
                badge={post.sponsored ? m['blog.sponsored']() : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </DirectoryLayout>
  );
}
