import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';

import { envConfigs } from '@/config';
import { getHomepageDataFn } from '@/modules/directory/server';
import { directoryHomeTitle } from '@/lib/directory/page-title';
import { m } from '@/paraglide/messages.js';
import { getLocale, locales, localizeUrl } from '@/paraglide/runtime.js';
import { CategoryStrip } from '@/components/directory/CategoryStrip';
import { DirectoryLayout } from '@/components/directory/DirectoryLayout';
import { FaqSection } from '@/components/directory/FaqSection';
import { FeaturedHero } from '@/components/directory/FeaturedHero';
import { RightSidebar } from '@/components/directory/RightSidebar';
import { ToolCard } from '@/components/directory/ToolCard';

export const Route = createFileRoute('/')({
  loader: async () => {
    const locale = getLocale();
    const dbData = await getHomepageDataFn({ data: { locale } });
    return { locale, dbData };
  },
  head: ({ loaderData }) => {
    const locale = loaderData?.locale ?? 'en';
    const totalCount = loaderData?.dbData?.totalProjects ?? 0;
    const urlFor = (loc: string) =>
      localizeUrl(`${envConfigs.app_url}/`, { locale: loc as any }).href;
    return {
      meta: [
        {
          title: directoryHomeTitle(locale),
        },
        {
          name: 'description',
          content: m['directory.subtitle'](
            { count: totalCount },
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
  component: HomePage,
});

function HomePage() {
  const { dbData } = Route.useLoaderData();

  const categories = dbData?.categories ?? [];
  const tags = dbData?.tags ?? [];
  const topPicks = dbData?.topPicks ?? [];
  const heroTool = dbData?.heroTool ?? null;
  const recommendedTools = dbData?.recommended ?? [];
  const latestTools = dbData?.latest ?? [];
  const categorySections = dbData?.categorySections ?? [];
  const totalCount = dbData?.totalProjects ?? 0;

  return (
    <DirectoryLayout>
      <div className="grid grid-cols-1 gap-10 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          {/* Hero Header */}
          <header className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {m['directory.title']()}
            </h1>
            <p className="text-muted-foreground mt-1.5 text-sm sm:text-[15px]">
              {m['directory.subtitle']({ count: totalCount })}
            </p>
          </header>

          {/* Featured Hero Area */}
          <FeaturedHero hero={heroTool} categories={categories} />

          {/* Categories Bar */}
          <CategoryStrip categories={categories} />
          {/* Recommended Section */}
          {recommendedTools.length > 0 ? (
            <section className="mt-8">
              <div className="flex items-baseline justify-between gap-4 pb-3">
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <h2 className="text-lg font-semibold tracking-tight">
                    {m['directory.recommended']()}
                  </h2>
                  <p className="text-muted-foreground text-[13px]">
                    {m['directory.recommended_desc']()}
                  </p>
                </div>
                <Link
                  to={'/tools' as any}
                  className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1 text-[13px] font-medium transition"
                >
                  {m['directory.view_all']()}
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {recommendedTools.map((tool: any) => (
                  <ToolCard key={tool.id} tool={tool} />
                ))}
              </div>
            </section>
          ) : null}

          {/* Just Added Section */}
          {latestTools.length > 0 ? (
            <section className="mt-10">
              <div className="flex items-baseline justify-between gap-4 pb-3">
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <h2 className="text-lg font-semibold tracking-tight">
                    {m['directory.just_added']()}
                  </h2>
                  <p className="text-muted-foreground text-[13px]">
                    {m['directory.just_added_desc']()}
                  </p>
                </div>
                <Link
                  to={'/feed' as any}
                  className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1 text-[13px] font-medium transition"
                >
                  {m['directory.view_all']()}
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {latestTools.map((tool: any) => (
                  <ToolCard key={tool.id} tool={tool} />
                ))}
              </div>
            </section>
          ) : null}

          {/* Category Sections */}
          {categorySections.map((section: any) => (
            <section key={section.category.slug} className="mt-10">
              <div className="flex items-baseline justify-between gap-4 pb-3">
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <h2 className="text-lg font-semibold tracking-tight">
                    {section.category.name}
                  </h2>
                  {section.category.description ? (
                    <p className="text-muted-foreground text-[13px]">
                      {section.category.description}
                    </p>
                  ) : null}
                </div>
                <Link
                  to={'/tools' as any}
                  search={{ category: section.category.slug } as any}
                  className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1 text-[13px] font-medium transition"
                >
                  {m['directory.view_all']()}
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {section.projects.map((tool: any) => (
                  <ToolCard key={tool.id} tool={tool} />
                ))}
              </div>
            </section>
          ))}

          {/* FAQ Section */}
          <FaqSection />
        </div>

        {/* Right Sidebar Widget Column */}
        <RightSidebar topPicks={topPicks} tags={tags} />
      </div>
    </DirectoryLayout>
  );
}
