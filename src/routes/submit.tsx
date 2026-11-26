import { useEffect, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';

import { envConfigs } from '@/config';
import { m } from '@/paraglide/messages.js';
import { getLocale, locales, localizeUrl } from '@/paraglide/runtime.js';
import { DirectoryFooter } from '@/components/directory/DirectoryFooter';
import { DirectoryHeader } from '@/components/directory/DirectoryHeader';
import { useDirectorySidebarState } from '@/components/directory/DirectoryLayout';
import { DirectorySidebar } from '@/components/directory/DirectorySidebar';
import { SearchModal } from '@/components/directory/SearchModal';
import { SubmitForm } from '@/components/directory/SubmitForm';

function SubmitPage() {
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
            <div className="mx-auto w-full max-w-[1080px] max-w-[1320px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
              <header className="mb-10 max-w-3xl">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  {m['dir.submit.title']()}
                </h1>
                <p className="text-muted-foreground mt-2 text-base">
                  {m['dir.submit.desc']()}
                </p>
              </header>

              <SubmitForm />
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

export const Route = createFileRoute('/submit')({
  loader: async () => {
    const locale = getLocale();
    return { locale };
  },
  head: ({ loaderData }) => {
    const locale = loaderData?.locale ?? 'en';
    const urlFor = (loc: string) =>
      localizeUrl(`${envConfigs.app_url}/submit`, { locale: loc as any }).href;
    return {
      meta: [
        {
          title: `${m['directory.submit_page_title']({}, { locale: locale as any })} | ${m['directory.brand_name']({}, { locale: locale as any })}`,
        },
        {
          name: 'description',
          content: m['dir.submit.desc']({}, { locale: locale as any }),
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
  component: SubmitPage,
});
