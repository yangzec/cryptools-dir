import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { Calendar, ExternalLink, Shapes, Sparkles, User } from 'lucide-react';

import { withDirectoryUtm } from '@/lib/directory/structured-data';
import { m } from '@/paraglide/messages.js';
import { ScreenshotGallery } from '@/components/directory/ScreenshotGallery';
import {
  StickySectionNav,
  type SectionTabItem,
} from '@/components/directory/StickySectionNav';
import { ToolDetailSections } from '@/components/directory/ToolDetailSections';

type TagItem = { id: string; slug: string; name: string };
type CollectionItem = { id: string; slug: string; name: string };
type FeatureItem = { title: string; description: string };
type FaqItem = { question: string; answer: string };

export type ToolDetailTool = {
  name: string;
  tagline?: string | null;
  featured?: boolean;
  plan?: string | null;
  websiteUrl?: string | null;
  iconUrl?: string | null;
  categoryName?: string | null;
  categorySlug?: string | null;
  authorName?: string | null;
  publishedAt?: string | Date | null;
  introduction?: string | null;
  howToUse?: string | null;
  tags?: TagItem[];
  collections?: CollectionItem[];
  features?: FeatureItem[];
  useCases?: FeatureItem[];
  faqs?: FaqItem[];
  pros?: string[];
  cons?: string[];
  screenshots?: string[];
};

export function ToolDetailContent({
  tool,
  openFaqIndex,
  setOpenFaqIndex,
}: {
  tool: ToolDetailTool;
  openFaqIndex: number | null;
  setOpenFaqIndex: (index: number | null) => void;
}) {
  const tags = tool.tags || [];
  const collections = tool.collections || [];
  const features = tool.features || [];
  const useCases = tool.useCases || [];
  const faqs = tool.faqs || [];
  const pros = tool.pros || [];
  const cons = tool.cons || [];
  const screenshots = tool.screenshots || [];

  // Parse howToUse into ordered steps if it is formatted like "1. ...\n2. ..."
  const howToUseSteps = useMemo(() => {
    if (!tool.howToUse) return [];
    return tool.howToUse
      .split('\n')
      .map((line: string) => line.trim())
      .filter(Boolean)
      .map((line: string) => line.replace(/^\d+[\.\)]\s*/, ''));
  }, [tool.howToUse]);

  // Build section navigation tabs
  const overviewContent = tool.introduction || tool.tagline;
  const navTabs = useMemo<SectionTabItem[]>(() => {
    const list: SectionTabItem[] = [];
    if (overviewContent) {
      list.push({ id: 'what-is', label: m['directory.detail.tab_overview']() });
    }
    if (tool.howToUse) {
      list.push({
        id: 'how-to-use',
        label: m['directory.detail.tab_how_to_use'](),
      });
    }
    if (features.length > 0) {
      list.push({
        id: 'features',
        label: m['directory.detail.tab_features'](),
      });
    }
    if (useCases.length > 0) {
      list.push({
        id: 'use-cases',
        label: m['directory.detail.tab_use_cases'](),
      });
    }
    if (pros.length > 0 || cons.length > 0) {
      list.push({
        id: 'pros-cons',
        label: m['directory.detail.tab_pros_cons'](),
      });
    }
    if (faqs.length > 0) {
      list.push({ id: 'faq', label: m['directory.detail.tab_faq']() });
    }
    return list;
  }, [tool.introduction, tool.howToUse, features, useCases, pros, cons, faqs]);

  const listedDateFormatted = useMemo(() => {
    if (!tool.publishedAt) return null;
    const date = new Date(tool.publishedAt);
    return date.toISOString().split('T')[0];
  }, [tool.publishedAt]);

  return (
    <div className="min-w-0">
      {/* Header: Icon, Name, Badge, Tagline */}
      <header className="mb-6 flex items-start gap-4">
        <div
          className="border-border/60 bg-card shrink-0 overflow-hidden rounded-md border"
          style={{ width: 64, height: 64 }}
        >
          {tool.iconUrl ? (
            <img
              src={tool.iconUrl}
              alt=""
              width={64}
              height={64}
              className="size-full object-cover"
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
            />
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="min-w-0 text-2xl font-bold tracking-tight sm:text-3xl">
              {tool.name}
            </h1>
            {tool.featured && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                <Sparkles className="size-3.5" />
                {m['directory.featured']()}
              </span>
            )}
          </div>
          {tool.tagline && (
            <p className="text-muted-foreground mt-1.5 text-base">
              {tool.tagline}
            </p>
          )}
        </div>
      </header>

      {/* Visit Website Action Button */}
      {tool.websiteUrl && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <a
            href={withDirectoryUtm(tool.websiteUrl)}
            target="_blank"
            // Premium paid listings: dofollow. Free / editorial: nofollow.
            rel={
              tool.plan === 'premium'
                ? 'noopener noreferrer'
                : 'nofollow noopener noreferrer'
            }
            className="bg-primary text-primary-foreground hover:bg-primary/80 inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition"
          >
            {m['directory.visit_website']()}
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      )}

      {/* Metadata dl list & Tags */}
      <div className="mb-8 space-y-4">
        <dl className="flex flex-wrap gap-x-6 gap-y-2">
          {tool.categoryName && (
            <div
              className="flex min-w-0 items-center gap-1.5"
              title={m['directory.detail.category']()}
            >
              <dt className="text-muted-foreground shrink-0">
                <Shapes className="size-4" />
                <span className="sr-only">
                  {m['directory.detail.category']()}
                </span>
              </dt>
              <dd className="truncate text-sm font-medium">
                <Link
                  to={`/tools?category=${tool.categorySlug}` as any}
                  className="hover:text-primary transition-colors"
                >
                  {tool.categoryName}
                </Link>
              </dd>
            </div>
          )}

          {tool.authorName && (
            <div
              className="flex min-w-0 items-center gap-1.5"
              title={m['directory.detail.maker']()}
            >
              <dt className="text-muted-foreground shrink-0">
                <User className="size-4" />
                <span className="sr-only">{m['directory.detail.maker']()}</span>
              </dt>
              <dd className="truncate text-sm font-medium">
                {tool.authorName}
              </dd>
            </div>
          )}

          {listedDateFormatted && (
            <div
              className="flex min-w-0 items-center gap-1.5"
              title={m['directory.detail.listed_on']()}
            >
              <dt className="text-muted-foreground shrink-0">
                <Calendar className="size-4" />
                <span className="sr-only">
                  {m['directory.detail.listed_on']()}
                </span>
              </dt>
              <dd className="truncate text-sm font-medium">
                <time dateTime={listedDateFormatted}>
                  {listedDateFormatted}
                </time>
              </dd>
            </div>
          )}
        </dl>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Link
                key={tag.id}
                to={`/tools?tag=${tag.slug}` as any}
                className="bg-secondary text-secondary-foreground hover:bg-primary/10 hover:text-primary inline-flex h-8 items-center rounded-full px-3.5 text-sm font-medium transition"
              >
                #{tag.name}
              </Link>
            ))}
          </div>
        )}

        {collections.length > 0 && (
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {m['directory.collections.in_collections']()}
            </p>
            <div className="flex flex-wrap gap-2">
              {collections.map((collection) => (
                <Link
                  key={collection.id}
                  to={`/collections/${collection.slug}` as any}
                  className="border-border hover:border-primary/40 hover:text-primary inline-flex h-8 items-center rounded-lg border px-3 text-sm font-medium transition"
                >
                  {collection.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Screenshots Gallery Area (Tabs, Arrows, Zoom Lightbox) */}
      <ScreenshotGallery toolName={tool.name} screenshots={screenshots} />

      {/* Sticky Navigation Tab Bar */}
      <StickySectionNav tabs={navTabs} />

      {/* Content Sections */}
      <ToolDetailSections
        toolName={tool.name}
        overviewContent={overviewContent}
        howToUse={tool.howToUse}
        howToUseSteps={howToUseSteps}
        features={features}
        useCases={useCases}
        pros={pros}
        cons={cons}
        faqs={faqs}
        openFaqIndex={openFaqIndex}
        setOpenFaqIndex={setOpenFaqIndex}
      />
    </div>
  );
}
