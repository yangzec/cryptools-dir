import { useEffect, useState, type ReactNode } from 'react';

import { DirectoryFooter } from '@/components/directory/DirectoryFooter';
import { DirectoryHeader } from '@/components/directory/DirectoryHeader';
import { DirectorySidebar } from '@/components/directory/DirectorySidebar';
import { SearchModal } from '@/components/directory/SearchModal';

interface DirectoryLayoutProps {
  children: ReactNode;
}

/** PanelLeft: collapse desktop rail on lg+, open drawer below lg. */
export function useDirectorySidebarState() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(true);

  const toggleSidebar = () => {
    if (window.matchMedia('(min-width: 1024px)').matches) {
      setDesktopOpen((open) => !open);
    } else {
      setMobileOpen((open) => !open);
    }
  };

  return {
    mobileOpen,
    desktopOpen,
    toggleSidebar,
    closeMobileSidebar: () => setMobileOpen(false),
    frameClassName: desktopOpen
      ? 'lg:grid lg:grid-cols-[240px_minmax(0,1fr)]'
      : '',
  };
}

export function DirectoryLayout({ children }: DirectoryLayoutProps) {
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
        {/* Left Navigation Sidebar */}
        <DirectorySidebar
          mobileOpen={mobileOpen}
          desktopOpen={desktopOpen}
          onMobileClose={closeMobileSidebar}
        />

        {/* Main Content Area */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top Header */}
          <DirectoryHeader
            desktopOpen={desktopOpen}
            onToggleSidebar={toggleSidebar}
            onSearchClick={() => setSearchModalOpen(true)}
          />

          {/* Page Content */}
          <main className="flex-1">
            <div className="mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
              {children}
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
