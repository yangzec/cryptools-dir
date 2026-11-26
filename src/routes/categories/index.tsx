import { createFileRoute, Link } from '@tanstack/react-router';
import {
  ArrowRight,
  AudioLines,
  ChevronRight,
  Code,
  Folder,
  Image,
  MessageSquare,
  PenTool,
  Search,
  Video,
  WandSparkles,
} from 'lucide-react';

import { envConfigs } from '@/config';
import { getDirectoryCategoriesFn } from '@/modules/directory/server';
import { directoryCategoriesTitle } from '@/lib/directory/page-title';
import { m } from '@/paraglide/messages.js';
import { getLocale, locales, localizeUrl } from '@/paraglide/runtime.js';
import { DirectoryLayout } from '@/components/directory/DirectoryLayout';

function getCategoryIcon(slug: string, iconName?: string | null) {
  const name = (iconName || slug || '').toLowerCase();
  if (name.includes('chat') || name.includes('message')) return MessageSquare;
  if (name.includes('code') || name.includes('coding')) return Code;
  if (name.includes('image')) return Image;
  if (name.includes('video')) return Video;
  if (
    name.includes('audio') ||
    name.includes('music') ||
    name.includes('voice')
  ) {
    return AudioLines;
  }
  if (
    name.includes('pen') ||
    name.includes('write') ||
    name.includes('writing')
  ) {
    return PenTool;
  }
  if (
    name.includes('wand') ||
    name.includes('spark') ||
    name.includes('prod') ||
    name.includes('productivity')
  ) {
    return WandSparkles;
  }
  if (name.includes('search') || name.includes('research')) return Search;
  return Folder;
}

export const Route = createFileRoute('/categories/')({
  loader: async () => {
    const locale = getLocale();
    const categories = await getDirectoryCategoriesFn({ data: { locale } });
    return { locale, categories };
  },
  head: ({ loaderData }) => {
    const locale = loaderData?.locale ?? 'en';
    const count = loaderData?.categories?.length ?? 0;
    const urlFor = (loc: string) =>
      localizeUrl(`${envConfigs.app_url}/categories`, { locale: loc as any })
        .href;
    return {
      meta: [
        {
          title: directoryCategoriesTitle(locale, count),
        },
        {
          name: 'description',
          content: m['directory.categories.subtitle'](
            {},
            { locale: locale as any }
          ),
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
  component: CategoriesPage,
});

function CategoriesPage() {
  const { categories } = Route.useLoaderData();

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
          {m['directory.categories']()}
        </span>
      </nav>

      {/* Page Header */}
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        {m['directory.categories.title']()}
      </h1>
      <p className="text-muted-foreground mt-1.5 mb-8 max-w-2xl text-sm">
        {m['directory.categories.subtitle']()}
      </p>

      {/* Category Cards Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => {
          const Icon = getCategoryIcon(category.slug, category.icon);
          return (
            <Link
              key={category.id}
              to={`/categories/${category.slug}` as any}
              className="group border-border bg-card hover:border-primary/30 flex items-start gap-4 rounded-md border p-4 transition hover:shadow-md"
            >
              <span className="bg-primary/10 text-primary grid size-10 shrink-0 place-items-center rounded-md">
                <Icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="truncate font-semibold">{category.name}</h2>
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                    {m['directory.categories.tools_count']({
                      count: category.projectCount,
                    })}
                  </span>
                </div>
                {category.description && (
                  <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                    {category.description}
                  </p>
                )}
              </div>
              <ArrowRight className="text-muted-foreground group-hover:text-primary mt-0.5 size-4 shrink-0 transition" />
            </Link>
          );
        })}
      </div>
    </DirectoryLayout>
  );
}
