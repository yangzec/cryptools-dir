import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { z } from 'zod';

import { envConfigs } from '@/config';
import { getDirectoryToolsFn } from '@/modules/directory/server';
import { directoryToolsTitle } from '@/lib/directory/page-title';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { getLocale, locales, localizeUrl } from '@/paraglide/runtime.js';
import { DirectoryPagination } from '@/components/directory/DirectoryCommon';
import { DirectoryLayout } from '@/components/directory/DirectoryLayout';
import { DirectorySortSelect } from '@/components/directory/DirectorySortSelect';
import { SponsorAdsSlot } from '@/components/directory/SponsorAdsSlot';
import { ToolCard } from '@/components/directory/ToolCard';

const toolsSearchSchema = z.object({
  category: z.string().optional(),
  tag: z.string().optional(),
  sort: z.enum(['recommended', 'latest', 'name', 'popular']).optional(),
  page: z.number().int().positive().optional(),
});

export const Route = createFileRoute('/tools/')({
  validateSearch: (
    search: Record<string, unknown>
  ): {
    category?: string;
    tag?: string;
    sort?: 'recommended' | 'latest' | 'name' | 'popular';
    page?: number;
  } => {
    const res: {
      category?: string;
      tag?: string;
      sort?: 'recommended' | 'latest' | 'name' | 'popular';
      page?: number;
    } = {};
    if (typeof search.category === 'string' && search.category) {
      res.category = search.category;
    }
    if (typeof search.tag === 'string' && search.tag) {
      res.tag = search.tag;
    }
    if (
      typeof search.sort === 'string' &&
      search.sort &&
      search.sort !== 'recommended' &&
      ['latest', 'name', 'popular'].includes(search.sort)
    ) {
      res.sort = search.sort as any;
    }
    const pageNum = Number(search.page);
    if (!Number.isNaN(pageNum) && pageNum > 1) {
      res.page = pageNum;
    }
    return res;
  },
  loaderDeps: ({ search }) => ({
    category: search.category,
    tag: search.tag,
    sort: search.sort,
    page: search.page || 1,
  }),
  loader: async ({ deps }) => {
    const locale = getLocale();
    const data = await getDirectoryToolsFn({
      data: {
        locale,
        category: deps.category,
        tag: deps.tag,
        sort: deps.sort || 'recommended',
        page: deps.page,
        pageSize: 24,
      },
    });
    return {
      locale,
      data,
      currentCategory: deps.category,
      currentTag: deps.tag,
      currentSort: deps.sort || 'recommended',
      currentPage: deps.page,
    };
  },
  head: ({ loaderData }) => {
    const locale = loaderData?.locale ?? 'en';
    const total = loaderData?.data?.total ?? 0;
    const urlFor = (loc: string) =>
      localizeUrl(`${envConfigs.app_url}/tools`, { locale: loc as any }).href;
    return {
      meta: [
        {
          title: directoryToolsTitle(locale, total),
        },
        {
          name: 'description',
          content: m['directory.tools.subtitle']({}, { locale: locale as any }),
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
  component: ToolsPage,
});

function ToolsPage() {
  const { data, currentCategory, currentTag, currentSort, currentPage } =
    Route.useLoaderData();
  const navigate = useNavigate({ from: Route.fullPath });

  const { items = [], total = 0, pageSize = 24, categories = [] } = data;
  const totalPages = Math.ceil(total / pageSize);

  const handleSortChange = (newSort: string) => {
    navigate({
      search: (prev) => ({
        ...prev,
        sort: newSort === 'recommended' ? undefined : (newSort as any),
        page: undefined,
      }),
    });
  };

  const handlePageChange = (page: number) => {
    navigate({
      search: (prev) => ({
        ...prev,
        page: page > 1 ? page : undefined,
      }),
    });
  };

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
          {m['directory.tools']()}
        </span>
      </nav>

      {/* Page Header */}
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {m['directory.tools.title']()}
        </h1>
        <p className="text-muted-foreground mt-1.5 max-w-2xl text-sm">
          {m['directory.tools.subtitle']()}
        </p>
      </header>

      {currentTag ? (
        <div className="mb-4">
          <span className="bg-secondary text-secondary-foreground inline-flex items-center rounded-full px-3 py-1 text-xs font-medium">
            #{currentTag}
          </span>
        </div>
      ) : null}

      {/* Category Strip */}
      <div className="mb-6">
        <nav className="scrollbar-none -mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <Link
            to="/tools"
            search={(prev) => ({
              ...prev,
              category: undefined,
              tag: undefined,
              page: undefined,
            })}
            activeOptions={{ exact: true }}
            aria-current={!currentCategory ? 'page' : undefined}
            className={cn(
              'inline-flex h-8 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition',
              !currentCategory
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
            )}
          >
            {m['directory.all']()}
          </Link>
          {categories.map((cat) => {
            const isActive = currentCategory === cat.slug;
            return (
              <Link
                key={cat.id || cat.slug}
                to="/tools"
                search={(prev) => ({
                  ...prev,
                  category: cat.slug,
                  tag: undefined,
                  page: undefined,
                })}
                activeOptions={{ exact: true }}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'inline-flex h-8 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition',
                  isActive
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
                )}
              >
                {cat.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Toolbar: Count & Sort */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-muted-foreground text-sm font-normal">
          {currentCategory
            ? m['directory.tools.filtered_count']({ count: total })
            : m['directory.tools.all_count']({ count: total })}
        </h2>

        <DirectorySortSelect value={currentSort} onChange={handleSortChange} />
      </div>

      <div className="mb-6 max-w-md">
        <SponsorAdsSlot placement="listing" limit={4} />
      </div>

      {/* Tools Grid */}
      {items.length === 0 ? (
        <div className="border-border text-muted-foreground rounded-xl border border-dashed py-16 text-center text-sm">
          {m['directory.no_tools']()}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex justify-center">
          <DirectoryPagination
            currentPage={currentPage || 1}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </DirectoryLayout>
  );
}
