import { useEffect, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';

import { envConfigs } from '@/config';
import {
  getDirectoryCategoriesFn,
  getDirectoryToolsFn,
  getSponsorTierInventoryFn,
} from '@/modules/directory/server';
import { m } from '@/paraglide/messages.js';
import { getLocale, locales, localizeUrl } from '@/paraglide/runtime.js';
import { AdvertiseForm } from '@/components/directory/AdvertiseForm';
import { DirectoryFooter } from '@/components/directory/DirectoryFooter';
import { DirectoryHeader } from '@/components/directory/DirectoryHeader';
import { useDirectorySidebarState } from '@/components/directory/DirectoryLayout';
import { DirectorySidebar } from '@/components/directory/DirectorySidebar';
import { SearchModal } from '@/components/directory/SearchModal';

function AdvertisePage() {
  const { inventory, toolCount, categoryCount } = Route.useLoaderData();
  const { rebook } = Route.useSearch();
  const {
    mobileOpen,
    desktopOpen,
    toggleSidebar,
    closeMobileSidebar,
    frameClassName,
  } = useDirectorySidebarState();
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className={frameClassName}>
        {/* Left Sidebar */}
        <DirectorySidebar
          mobileOpen={mobileOpen}
          desktopOpen={desktopOpen}
          onMobileClose={closeMobileSidebar}
        />

        {/* Main Content Area */}
        <div className="flex min-h-screen min-w-0 flex-col">
          {/* Top Header */}
          <DirectoryHeader
            desktopOpen={desktopOpen}
            onToggleSidebar={toggleSidebar}
            onSearchClick={() => setSearchModalOpen(true)}
          />

          {/* Content Pane */}
          <main className="flex-1">
            <div className="mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
              <header className="mb-10 max-w-3xl">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  {m['dir.sponsor.title']()}
                </h1>
                <p className="text-muted-foreground mt-2 text-base">
                  {m['dir.sponsor.advertise_hint']()}
                </p>
                <p className="text-muted-foreground mt-3 text-xs">
                  {m['dir.sponsor.stats_desc']({
                    tools: String(toolCount),
                    categories: String(categoryCount),
                  })}
                </p>
              </header>

              <AdvertiseForm inventory={inventory} rebook={rebook === '1'} />
            </div>
          </main>

          {/* Footer */}
          <DirectoryFooter />
        </div>
      </div>

      {/* Global Search Dialog */}
      <SearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
      />
    </div>
  );
}

export const Route = createFileRoute('/advertise')({
  validateSearch: (search: Record<string, unknown>): { rebook?: '1' } => ({
    rebook: search.rebook === '1' || search.rebook === 1 ? '1' : undefined,
  }),
  loader: async () => {
    const locale = getLocale();
    const [inventory, toolsResult, categories] = await Promise.all([
      getSponsorTierInventoryFn(),
      getDirectoryToolsFn({
        data: { locale, page: 1, pageSize: 1 },
      }),
      getDirectoryCategoriesFn({ data: { locale } }),
    ]);
    return {
      locale,
      inventory,
      toolCount: toolsResult?.total ?? 0,
      categoryCount: categories?.length ?? 0,
    };
  },
  head: ({ loaderData }) => {
    const locale = loaderData?.locale ?? 'en';
    const urlFor = (loc: string) =>
      localizeUrl(`${envConfigs.app_url}/advertise`, { locale: loc as any })
        .href;
    return {
      meta: [
        {
          title: `${m['directory.ad_page_title']({}, { locale: locale as any })} | ${m['directory.brand_name']({}, { locale: locale as any })}`,
        },
        {
          name: 'description',
          content: m['dir.sponsor.advertise_hint'](
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
  component: AdvertisePage,
});
