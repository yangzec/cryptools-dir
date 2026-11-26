import { createFileRoute, Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';

import { envConfigs } from '@/config';
import { getDirectoryTagsFn } from '@/modules/directory/server';
import { directoryTagsTitle } from '@/lib/directory/page-title';
import { m } from '@/paraglide/messages.js';
import { getLocale, locales, localizeUrl } from '@/paraglide/runtime.js';
import { DirectoryLayout } from '@/components/directory/DirectoryLayout';

export const Route = createFileRoute('/tags/')({
  loader: async () => {
    const locale = getLocale();
    const tags = await getDirectoryTagsFn({ data: { locale } });
    return { locale, tags };
  },
  head: ({ loaderData }) => {
    const locale = loaderData?.locale ?? 'en';
    const count = loaderData?.tags?.length ?? 0;
    const urlFor = (loc: string) =>
      localizeUrl(`${envConfigs.app_url}/tags`, { locale: loc as any }).href;
    return {
      meta: [
        {
          title: directoryTagsTitle(locale, count),
        },
        {
          name: 'description',
          content: m['directory.tags.subtitle']({}, { locale: locale as any }),
        },
      ],
      links: [
        { rel: 'canonical', href: urlFor(locale) },
        ...locales.map((loc) => ({
          rel: 'alternate',
          hrefLang: loc,
          href: urlFor(loc),
        })),
        { rel: 'alternate', hrefLang: 'x-default', href: urlFor('en') },
      ],
    };
  },
  component: TagsPage,
});

function TagsPage() {
  const { tags } = Route.useLoaderData();

  return (
    <DirectoryLayout>
      {/* Breadcrumbs */}
      <nav
        aria-label="breadcrumb"
        className="text-muted-foreground mb-5 flex items-center gap-1.5 text-sm"
      >
        <Link to="/" className="hover:text-foreground shrink-0">
          {m['directory.discover']()}
        </Link>
        <ChevronRight className="size-3.5 shrink-0" />
        <span aria-current="page" className="text-foreground min-w-0 truncate">
          {m['directory.tags']()}
        </span>
      </nav>

      {/* Page Header */}
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        {m['directory.tags.title']()}
      </h1>
      <p className="text-muted-foreground mt-1.5 mb-8 max-w-2xl text-sm">
        {m['directory.tags.subtitle']()}
      </p>

      {/* Tags Cloud / Pills */}
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <Link
            key={tag.id}
            to="/tags/$slug"
            params={{ slug: tag.slug }}
            className="bg-secondary text-secondary-foreground hover:bg-primary/10 hover:text-primary inline-flex h-8 items-center rounded-full px-3.5 text-sm font-medium transition"
          >
            #{tag.name}
            <span className="text-muted-foreground ml-1.5 tabular-nums">
              {tag.projectCount}
            </span>
          </Link>
        ))}
      </div>
    </DirectoryLayout>
  );
}
