import {
  createFileRoute,
  Link,
  notFound,
  useNavigate,
} from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { z } from 'zod';

import { envConfigs } from '@/config';
import {
  getDirectoryCollectionBySlugFn,
  getDirectoryToolsFn,
} from '@/modules/directory/server';
import { withDirectoryBrand } from '@/lib/directory/page-title';
import { listingJsonLd } from '@/lib/directory/structured-data';
import { m } from '@/paraglide/messages.js';
import { getLocale, locales, localizeUrl } from '@/paraglide/runtime.js';
import { DirectoryPagination } from '@/components/directory/DirectoryCommon';
import { DirectoryLayout } from '@/components/directory/DirectoryLayout';
import { DirectorySortSelect } from '@/components/directory/DirectorySortSelect';
import { SponsorAdsSlot } from '@/components/directory/SponsorAdsSlot';
import { ToolCard } from '@/components/directory/ToolCard';

const collectionSearchSchema = z.object({
  page: z.number().int().positive().optional(),
  sort: z.enum(['recommended', 'latest', 'name', 'popular']).optional(),
});

export const Route = createFileRoute('/collections/$slug')({
  validateSearch: (
    search: Record<string, unknown>
  ): {
    page?: number;
    sort?: 'recommended' | 'latest' | 'name' | 'popular';
  } => {
    const parsed = collectionSearchSchema.safeParse(search);
    if (!parsed.success) return {};
    const res: {
      page?: number;
      sort?: 'recommended' | 'latest' | 'name' | 'popular';
    } = {};
    if (parsed.data.page && parsed.data.page > 1) res.page = parsed.data.page;
    if (parsed.data.sort && parsed.data.sort !== 'recommended') {
      res.sort = parsed.data.sort;
    }
    return res;
  },
  loaderDeps: ({ search }) => ({
    page: search.page,
    sort: search.sort,
  }),
  loader: async ({ params, deps }) => {
    const locale = getLocale();
    const collection = await getDirectoryCollectionBySlugFn({
      data: {
        locale,
        slug: params.slug,
      },
    });
    if (!collection) {
      throw notFound();
    }

    const toolsData = await getDirectoryToolsFn({
      data: {
        locale,
        collection: params.slug,
        page: deps.page || 1,
        sort: deps.sort || 'recommended',
        pageSize: 24,
      },
    });

    return {
      locale,
      slug: params.slug,
      collectionName: collection.name,
      collectionDescription: collection.description || '',
      toolsData,
      currentPage: deps.page || 1,
      currentSort: deps.sort || 'recommended',
    };
  },
  head: ({ loaderData, params }) => {
    const locale = loaderData?.locale ?? 'en';
    const total = loaderData?.toolsData?.total ?? 0;
    const collectionName = loaderData?.collectionName || params.slug;
    const year = new Date().getFullYear();

    const titleText = m['directory.collections.meta_title'](
      { name: collectionName, count: total, year },
      { locale: locale as any }
    );

    const urlFor = (loc: string) =>
      localizeUrl(`${envConfigs.app_url}/collections/${params.slug}`, {
        locale: loc as any,
      }).href;

    const items = loaderData?.toolsData?.items || [];
    const description =
      loaderData?.collectionDescription ||
      m['directory.collections.meta_desc'](
        { name: collectionName, count: total },
        { locale: locale as any }
      );

    return {
      meta: [
        { title: withDirectoryBrand(locale, titleText) },
        { name: 'description', content: description },
        {
          'script:ld+json': listingJsonLd({
            name: titleText,
            description,
            path: `/collections/${params.slug}`,
            items: items.map((t: any) => ({
              name: t.name,
              slug: t.slug,
              tagline: t.tagline,
            })),
          }),
        } as any,
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
  component: CollectionDetailPage,
});

function CollectionDetailPage() {
  const {
    locale,
    collectionName,
    collectionDescription,
    toolsData,
    currentPage,
    currentSort,
  } = Route.useLoaderData();
  const navigate = useNavigate({ from: Route.fullPath });

  const items = toolsData?.items || [];
  const total = toolsData?.total || 0;
  const pageSize = toolsData?.pageSize || 24;
  const totalPages = Math.ceil(total / pageSize);

  const headingText = collectionName;
  const countText = m['directory.collections.curated_count']({ count: total });

  const handleSortChange = (newSort: string) => {
    navigate({
      search: (prev: any) => ({
        ...prev,
        sort: newSort === 'recommended' ? undefined : newSort,
        page: undefined,
      }),
    });
  };

  const handlePageChange = (newPage: number) => {
    navigate({
      search: (prev: any) => ({
        ...prev,
        page: newPage > 1 ? newPage : undefined,
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
        <Link to="/collections" className="hover:text-foreground shrink-0">
          {m['directory.collections']()}
        </Link>
        <ChevronRight className="size-3.5 shrink-0" />
        <span aria-current="page" className="text-foreground min-w-0 truncate">
          {collectionName}
        </span>
      </nav>

      {/* Header */}
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {headingText}
        </h1>
        {collectionDescription && (
          <p className="text-muted-foreground mt-1.5 max-w-2xl text-sm leading-relaxed">
            {collectionDescription}
          </p>
        )}
      </header>

      {/* Toolbar: Count & Sort */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-muted-foreground text-sm font-normal">
          {countText}
        </h2>

        <DirectorySortSelect value={currentSort} onChange={handleSortChange} />
      </div>

      <div className="mb-6 max-w-md">
        <SponsorAdsSlot placement="listing" limit={4} />
      </div>

      {/* Tools Grid */}
      {items.length === 0 ? (
        <div className="border-border text-muted-foreground rounded-xl border border-dashed py-16 text-center text-sm">
          {m['directory.collections.empty']()}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((tool: any) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex justify-center">
          <DirectoryPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </DirectoryLayout>
  );
}
