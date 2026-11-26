import { createFileRoute, Link } from '@tanstack/react-router';
import {
  ArrowRight,
  AudioLines,
  ChevronRight,
  Code,
  Folder,
  Image,
  Layers,
  MessageSquare,
  PenTool,
  Search,
  Sparkles,
  Video,
  WandSparkles,
} from 'lucide-react';

import { envConfigs } from '@/config';
import { getDirectoryCollectionsFn } from '@/modules/directory/server';
import { directoryCollectionsTitle } from '@/lib/directory/page-title';
import { m } from '@/paraglide/messages.js';
import { getLocale, locales, localizeUrl } from '@/paraglide/runtime.js';
import { DirectoryLayout } from '@/components/directory/DirectoryLayout';

function getCollectionIcon(slug: string, iconName?: string | null) {
  const name = (iconName || slug || '').toLowerCase();
  if (name.includes('code') || name.includes('dev')) return Code;
  if (
    name.includes('image') ||
    name.includes('art') ||
    name.includes('design')
  ) {
    return Image;
  }
  if (name.includes('video') || name.includes('studio')) return Video;
  if (
    name.includes('audio') ||
    name.includes('voice') ||
    name.includes('music')
  ) {
    return AudioLines;
  }
  if (
    name.includes('prod') ||
    name.includes('write') ||
    name.includes('wand') ||
    name.includes('spark')
  ) {
    return WandSparkles;
  }
  if (name.includes('search') || name.includes('research')) return Search;
  if (name.includes('chat') || name.includes('bot')) return MessageSquare;
  if (name.includes('pen')) return PenTool;
  if (name.includes('layer')) return Layers;
  return Sparkles;
}

export const Route = createFileRoute('/collections/')({
  loader: async () => {
    const locale = getLocale();
    const collections = await getDirectoryCollectionsFn({ data: { locale } });
    return { locale, collections };
  },
  head: ({ loaderData }) => {
    const locale = loaderData?.locale ?? 'en';
    const count = loaderData?.collections?.length ?? 0;
    const urlFor = (loc: string) =>
      localizeUrl(`${envConfigs.app_url}/collections`, { locale: loc as any })
        .href;
    return {
      meta: [
        {
          title: directoryCollectionsTitle(locale, count),
        },
        {
          name: 'description',
          content: m['directory.collections.subtitle'](
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
  component: CollectionsPage,
});

function CollectionsPage() {
  const { collections } = Route.useLoaderData();

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
          {m['directory.collections']()}
        </span>
      </nav>

      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {m['directory.collections.title']()}
        </h1>
        <p className="text-muted-foreground mt-1.5 max-w-2xl text-sm">
          {m['directory.collections.subtitle']()}
        </p>
      </div>

      {/* Collections Grid */}
      {collections.length === 0 ? (
        <div className="border-border text-muted-foreground flex h-40 items-center justify-center rounded-xl border border-dashed text-sm">
          {m['directory.collections.empty_list']()}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((collection) => {
            const Icon = getCollectionIcon(collection.slug, collection.icon);
            return (
              <Link
                key={collection.id}
                to={`/collections/${collection.slug}` as any}
                className="group border-border bg-card hover:border-primary/40 relative flex flex-col justify-between overflow-hidden rounded-xl border p-5 transition-all hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="bg-primary/10 text-primary grid size-10 shrink-0 place-items-center rounded-lg">
                      <Icon className="size-5" />
                    </span>
                    <span className="border-border bg-secondary/80 text-muted-foreground shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium tabular-nums">
                      {m['directory.collections.tools_count']({
                        count: collection.projectCount,
                      })}
                    </span>
                  </div>

                  <h2 className="group-hover:text-primary mt-4 text-base font-semibold transition">
                    {collection.name}
                  </h2>
                  {collection.description && (
                    <p className="text-muted-foreground mt-1.5 line-clamp-2 text-[13px] leading-relaxed">
                      {collection.description}
                    </p>
                  )}
                </div>

                <div className="border-border/60 mt-5 flex items-center justify-between border-t pt-3.5">
                  {/* Tool icon preview avatars */}
                  <div className="flex -space-x-1.5 overflow-hidden">
                    {collection.previewTools &&
                    collection.previewTools.length > 0 ? (
                      collection.previewTools.map((tool: any) => (
                        <div
                          key={tool.id}
                          title={tool.name}
                          className="border-card bg-secondary ring-border/50 size-6 shrink-0 overflow-hidden rounded-full border ring-1"
                        >
                          {tool.iconUrl ? (
                            <img
                              src={tool.iconUrl}
                              alt={tool.name}
                              className="size-full object-cover"
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <div className="text-muted-foreground grid size-full place-items-center text-[9px] font-bold uppercase">
                              {tool.name.slice(0, 1)}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        {m['directory.tools']()}
                      </span>
                    )}
                  </div>

                  <span className="text-primary inline-flex items-center gap-1 text-xs font-medium transition-transform group-hover:translate-x-0.5">
                    {m['directory.browse']()}
                    <ArrowRight className="size-3.5" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </DirectoryLayout>
  );
}
