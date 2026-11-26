import { useMemo } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ChevronRight, Sparkles } from 'lucide-react';
import { z } from 'zod';

import { envConfigs } from '@/config';
import { getDirectoryFeedFn } from '@/modules/directory/server';
import { directoryFeedTitle } from '@/lib/directory/page-title';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { getLocale, locales, localizeUrl } from '@/paraglide/runtime.js';
import { DirectoryLayout } from '@/components/directory/DirectoryLayout';
import { SponsorAdsSlot } from '@/components/directory/SponsorAdsSlot';

const feedSearchSchema = z.object({
  type: z.enum(['all', 'community']).optional(),
});

export const Route = createFileRoute('/feed/')({
  validateSearch: (search: Record<string, unknown>): { type?: 'community' } => {
    const parsed = feedSearchSchema.safeParse(search);
    if (parsed.success && parsed.data.type === 'community') {
      return { type: 'community' };
    }
    return {};
  },
  loaderDeps: ({ search }) => ({
    type: search.type,
  }),
  loader: async ({ deps }) => {
    const locale = getLocale();
    const data = await getDirectoryFeedFn({
      data: {
        locale,
        type: deps.type,
      },
    });
    return { locale, data, currentType: deps.type || 'all' };
  },
  head: ({ loaderData }) => {
    const locale = loaderData?.locale ?? 'en';
    const urlFor = (loc: string) =>
      localizeUrl(`${envConfigs.app_url}/feed`, { locale: loc as any }).href;
    return {
      meta: [
        {
          title: directoryFeedTitle(locale),
        },
        {
          name: 'description',
          content: m['directory.feed.subtitle']({}, { locale: locale as any }),
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
  component: FeedPage,
});

function toUtcDateKey(dateInput: Date | string | number): string {
  return new Date(dateInput).toISOString().slice(0, 10);
}

function formatDateLabel(dateStr: string, locale: string): string {
  const todayKey = new Date().toISOString().slice(0, 10);
  const diffDays = Math.round(
    (Date.parse(todayKey) - Date.parse(dateStr)) / 86400000
  );

  if (diffDays === 0) {
    return m['directory.feed.today']({}, { locale: locale as any });
  }
  if (diffDays === 1) {
    return m['directory.feed.yesterday']({}, { locale: locale as any });
  }

  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return new Intl.DateTimeFormat(locale || 'en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function getFeedIconUrl(tool: {
  iconUrl?: string | null;
  websiteUrl?: string | null;
}): string {
  if (tool.websiteUrl) {
    try {
      const hostname = new URL(tool.websiteUrl).hostname;
      return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=128`;
    } catch {}
  }
  return tool.iconUrl || '/logo.png';
}

function FeedPage() {
  const { data, currentType, locale } = Route.useLoaderData();
  const activeType = currentType || 'all';
  const items = data?.items || [];

  // Group items by date string in UTC (newest first)
  const groupedItems = useMemo(() => {
    const groups: Array<{
      dateKey: string;
      dateLabel: string;
      tools: typeof items;
    }> = [];
    const dateMap = new Map<string, typeof items>();

    for (const item of items) {
      const rawDate = item.publishedAt || item.createdAt;
      const dateKey = toUtcDateKey(rawDate || new Date());

      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, []);
      }
      dateMap.get(dateKey)!.push(item);
    }

    const sortedKeys = Array.from(dateMap.keys()).sort((a, b) =>
      b.localeCompare(a)
    );

    for (const dateKey of sortedKeys) {
      const tools = dateMap.get(dateKey)!;
      groups.push({
        dateKey,
        dateLabel: formatDateLabel(dateKey, locale),
        tools,
      });
    }

    return groups;
  }, [items, locale]);

  return (
    <DirectoryLayout>
      {/* Breadcrumb */}
      <nav
        aria-label="breadcrumb"
        className="text-muted-foreground mb-5 flex items-center gap-1.5 text-sm"
      >
        <Link to="/" className="hover:text-foreground shrink-0">
          {m['directory.discover']()}
        </Link>
        <ChevronRight className="size-3.5 shrink-0" />
        <span aria-current="page" className="text-foreground min-w-0 truncate">
          {m['directory.feed']()}
        </span>
      </nav>

      {/* Header */}
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        {m['directory.feed.title']()}
      </h1>
      <p className="text-muted-foreground mt-1.5 mb-6 max-w-2xl text-sm">
        {m['directory.feed.subtitle']()}
      </p>

      {/* Filter Tabs */}
      <nav className="mb-8 flex gap-2">
        <Link
          to="/feed"
          search={{}}
          activeOptions={{ exact: true }}
          aria-current={activeType === 'all' ? 'page' : undefined}
          className={cn(
            'inline-flex h-8 items-center rounded-full border px-3.5 text-sm font-medium transition',
            activeType === 'all'
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
          )}
        >
          {m['directory.feed.all']()}
        </Link>
        <Link
          to="/feed"
          search={{ type: 'community' }}
          activeOptions={{ exact: true }}
          aria-current={activeType === 'community' ? 'page' : undefined}
          className={cn(
            'inline-flex h-8 items-center rounded-full border px-3.5 text-sm font-medium transition',
            activeType === 'community'
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
          )}
        >
          {m['directory.feed.community']()}
        </Link>
      </nav>

      {/* Main Grid: timeline on left, sponsors on right */}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {groupedItems.length === 0 ? (
            <div className="border-border text-muted-foreground flex h-40 flex-col items-center justify-center gap-3 rounded-xl border border-dashed text-sm">
              {activeType === 'community'
                ? m['directory.feed.empty_community']()
                : m['directory.feed.empty']()}
              {activeType === 'community' && (
                <Link
                  to="/submit"
                  className="bg-primary text-primary-foreground hover:bg-primary/80 group/button inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-full border border-transparent bg-clip-padding px-2.5 text-[0.8rem] font-medium whitespace-nowrap transition-all outline-none select-none"
                >
                  {m['directory.submit_tool']()}
                </Link>
              )}
            </div>
          ) : (
            <ol className="border-border relative space-y-8 border-l pl-6">
              {groupedItems.map((group) => (
                <li key={group.dateKey}>
                  <span className="bg-primary ring-background absolute -left-[5px] mt-1.5 size-2.5 rounded-full ring-4" />
                  <h2 className="mb-3 flex items-baseline gap-2">
                    <span className="text-base font-semibold">
                      {group.dateLabel}
                    </span>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {m['directory.feed.new_count']({
                        count: group.tools.length,
                      })}
                    </span>
                  </h2>
                  <ul className="border-border bg-card divide-border divide-y overflow-hidden rounded-xl border">
                    {group.tools.map((tool) => (
                      <li key={tool.id}>
                        <Link
                          to="/tools/$slug"
                          params={{ slug: tool.slug }}
                          className="hover:bg-secondary/50 flex items-center gap-3 px-4 py-3 transition"
                        >
                          <div
                            className="border-border/60 bg-secondary/50 shrink-0 overflow-hidden rounded-lg border"
                            style={{ width: 40, height: 40 }}
                          >
                            <img
                              src={getFeedIconUrl(tool)}
                              alt=""
                              className="size-full object-cover"
                              loading="lazy"
                              decoding="async"
                              width={40}
                              height={40}
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate font-semibold">
                                {tool.name}
                              </span>
                              {tool.featured && (
                                <span title="Featured" className="shrink-0">
                                  <Sparkles className="size-3.5 text-amber-500" />
                                  <span className="sr-only">Featured</span>
                                </span>
                              )}
                            </div>
                            {tool.tagline && (
                              <p className="text-muted-foreground truncate text-[13px]">
                                {tool.tagline}
                              </p>
                            )}
                          </div>
                          {tool.categoryName && (
                            <div className="hidden shrink-0 items-center gap-2 sm:flex">
                              <span className="bg-secondary text-secondary-foreground rounded-md px-2 py-0.5 text-[11px] font-medium">
                                {tool.categoryName}
                              </span>
                            </div>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Right Sidebar */}
        <aside className="self-start lg:sticky lg:top-[calc(var(--header-h,3.5rem)+1.5rem+var(--banner-h))]">
          <SponsorAdsSlot placement="listing" limit={4} />
        </aside>
      </div>
    </DirectoryLayout>
  );
}
