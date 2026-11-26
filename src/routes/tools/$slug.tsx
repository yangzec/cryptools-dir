import { useState } from 'react';
import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { ArrowRight, ChevronRight, Eye } from 'lucide-react';

import { envConfigs } from '@/config';
import {
  getDirectoryToolBySlugFn,
  getDirectoryToolPreviewFn,
  getHomepageDataFn,
} from '@/modules/directory/server';
import {
  directoryToolDetailTitle,
  withDirectoryBrand,
} from '@/lib/directory/page-title';
import { toolJsonLd } from '@/lib/directory/structured-data';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { getLocale, locales, localizeUrl } from '@/paraglide/runtime.js';
import { DirectoryLayout } from '@/components/directory/DirectoryLayout';
import { ToolCard } from '@/components/directory/ToolCard';
import { ToolDetailContent } from '@/components/directory/ToolDetailContent';
import { ToolDetailSidebar } from '@/components/directory/ToolDetailSidebar';
import { buttonVariants } from '@/components/ui/button';

export const Route = createFileRoute('/tools/$slug')({
  // ?preview=1: unpublished submission, for its author or an admin.
  validateSearch: (search: Record<string, unknown>): { preview?: boolean } =>
    search.preview === 1 || search.preview === '1' || search.preview === true
      ? { preview: true }
      : {},
  loaderDeps: ({ search }) => ({ preview: !!search.preview }),
  loader: async ({ params, deps }) => {
    const locale = getLocale();
    const [previewResult, homepageData] = await Promise.all([
      deps.preview
        ? getDirectoryToolPreviewFn({
            data: { locale, slug: params.slug },
          })
        : Promise.resolve(null),
      getHomepageDataFn({ data: { locale } }),
    ]);

    const tool =
      previewResult?.tool ??
      (await getDirectoryToolBySlugFn({
        data: { locale, slug: params.slug },
      }));

    if (!tool) {
      throw notFound();
    }

    return {
      locale,
      tool,
      preview: previewResult?.preview ?? false,
      previewInfo: previewResult?.previewInfo,
      topPicks: homepageData?.topPicks || [],
    };
  },
  head: ({ loaderData, params }) => {
    const locale = loaderData?.locale ?? 'en';
    const tool = loaderData?.tool;
    const title = tool
      ? directoryToolDetailTitle(locale, tool.name)
      : withDirectoryBrand(locale, params.slug);
    const description =
      tool?.tagline ||
      m['directory.tools.subtitle']({}, { locale: locale as any });

    if (loaderData?.preview) {
      return {
        meta: [{ title }, { name: 'robots', content: 'noindex, nofollow' }],
      };
    }

    const urlFor = (loc: string) =>
      localizeUrl(`${envConfigs.app_url}/tools/${params.slug}`, {
        locale: loc as any,
      }).href;

    return {
      meta: [
        { title },
        { name: 'description', content: description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:type', content: 'website' },
        {
          property: 'og:image',
          content: tool?.screenshots?.[0] || tool?.iconUrl || '',
        },
        { name: 'twitter:card', content: 'summary_large_image' },
        ...(tool
          ? [
              {
                'script:ld+json': toolJsonLd({
                  name: tool.name,
                  slug: tool.slug,
                  tagline: tool.tagline,
                  websiteUrl: tool.websiteUrl,
                  iconUrl: tool.iconUrl,
                  screenshots: tool.screenshots,
                  categoryName: tool.categoryName,
                  pricing: tool.pricing,
                  faqs: tool.faqs,
                }),
              } as any,
            ]
          : []),
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
  notFoundComponent: ToolNotFound,
  component: ToolDetailPage,
});

function ToolNotFound() {
  return (
    <DirectoryLayout>
      <div className="mx-auto max-w-[800px] py-20 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          {m['directory.tool_not_found']()}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {m['directory.tool_not_found_desc']()}
        </p>
        <Link
          to={'/tools' as any}
          className="bg-primary text-primary-foreground hover:bg-primary/90 mt-6 inline-flex h-9 items-center rounded-full px-4 text-sm font-medium"
        >
          {m['directory.back_to_tools']()}
        </Link>
      </div>
    </DirectoryLayout>
  );
}

function ToolPreviewBanner({
  info,
}: {
  info?: {
    toolId: string;
    status: 'published' | 'pending' | 'pending_payment' | 'rejected';
    isAuthor: boolean;
  };
}) {
  let text = m['directory.preview_banner']();
  if (info?.isAuthor) {
    if (info.status === 'pending_payment') {
      text = m['directory.preview_pending_payment']();
    } else if (info.status === 'pending') {
      text = m['directory.preview_pending']();
    } else if (info.status === 'rejected') {
      text = m['directory.preview_rejected']();
    }
  }

  return (
    <div className="mx-auto mb-8 flex max-w-[1320px] flex-wrap items-center gap-3 rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
      <Eye className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">{text}</span>
      <Link
        to={
          (info?.isAuthor
            ? '/settings/submissions'
            : '/admin/directory/tools') as any
        }
        className={cn(
          buttonVariants({ variant: 'outline', size: 'sm' }),
          'shrink-0 gap-1.5'
        )}
      >
        {info?.isAuthor
          ? m['directory.preview_my_submissions']()
          : m['directory.preview_back_review']()}
        <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}

function ToolDetailPage() {
  const { tool, topPicks, preview, previewInfo } = Route.useLoaderData();
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const related = tool.related || [];

  return (
    <DirectoryLayout>
      <div className="mx-auto w-full max-w-[1320px]">
        {preview ? <ToolPreviewBanner info={previewInfo} /> : null}

        {/* Breadcrumb Navigation */}
        <nav
          aria-label="breadcrumb"
          className="text-muted-foreground mb-6 flex items-center gap-1.5 text-sm"
        >
          <Link
            to="/"
            className="hover:text-foreground shrink-0 transition-colors"
          >
            {m['directory.discover']()}
          </Link>
          <ChevronRight className="size-3.5 shrink-0 opacity-50" />
          <Link
            to={'/tools' as any}
            className="hover:text-foreground shrink-0 transition-colors"
          >
            {m['directory.tools']()}
          </Link>
          <ChevronRight className="size-3.5 shrink-0 opacity-50" />
          <span className="text-foreground min-w-0 truncate font-medium">
            {tool.name}
          </span>
        </nav>

        {/* 2-Column Grid: Main Content + Right Sidebar */}
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          <ToolDetailContent
            tool={tool}
            openFaqIndex={openFaqIndex}
            setOpenFaqIndex={setOpenFaqIndex}
          />
          <ToolDetailSidebar
            topPicks={
              tool.popular && tool.popular.length > 0
                ? tool.popular
                : topPicks.filter((p) => p.slug !== tool.slug)
            }
          />
        </div>

        {/* Bottom Section: More in {Category} */}
        {related.length > 0 && (
          <section className="mt-12">
            <div className="flex items-baseline justify-between gap-4 pb-3">
              <h2 className="text-lg font-semibold tracking-tight">
                {m['directory.detail.more_in']({
                  category: tool.categoryName || 'Tools',
                })}
              </h2>
              <Link
                to={`/tools?category=${tool.categorySlug}` as any}
                className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1 text-[13px] font-medium transition"
              >
                <span>{m['directory.view_all']()}</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {related.map((item) => (
                <ToolCard key={item.id} tool={item} />
              ))}
            </div>
          </section>
        )}
      </div>
    </DirectoryLayout>
  );
}
