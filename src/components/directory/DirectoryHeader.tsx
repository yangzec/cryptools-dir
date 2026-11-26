import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { PanelLeft, Plus, Search } from 'lucide-react';

import { useSession } from '@/core/auth/client';
import { SITE_CONFIG } from '@/lib/directory-data';
import { m } from '@/paraglide/messages.js';
import { LocaleSelector } from '@/components/locale-selector';
import { SiteUserMenu } from '@/components/site-user-menu';
import { ThemeToggle } from '@/components/theme-toggle';

interface DirectoryHeaderProps {
  desktopOpen?: boolean;
  onToggleSidebar?: () => void;
  onSearchClick?: () => void;
}

export function DirectoryHeader({
  desktopOpen = true,
  onToggleSidebar,
  onSearchClick,
}: DirectoryHeaderProps) {
  // Keep SSR + first client paint identical; only swap Sign In / avatar after
  // mount + session settle (avoid flashing Sign In for an already-logged-in user).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { data: session, isPending } = useSession();
  const authReady = mounted && !isPending;
  const user = authReady ? session?.user : undefined;

  return (
    <header className="border-border bg-background/85 sticky top-0 z-30 border-b backdrop-blur">
      <div className="flex h-14 items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
        {/* Toggle Sidebar Button */}
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={m['directory.toggle_sidebar']()}
          title={m['directory.toggle_sidebar']()}
          className="text-muted-foreground hover:bg-secondary hover:text-foreground -ml-1.5 grid size-9 shrink-0 cursor-pointer place-items-center rounded-md transition-colors"
        >
          <PanelLeft className="size-[18px]" />
        </button>

        {/* Small Screen Logo / Desktop Collapsed Logo */}
        <div
          className={`shrink-0 ${
            desktopOpen ? 'hidden sm:block lg:hidden' : 'hidden sm:block'
          }`}
        >
          <Link to="/" className="flex min-w-0 items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={SITE_CONFIG.logo}
              alt={SITE_CONFIG.name}
              width={28}
              height={28}
              className="size-7 shrink-0 rounded-md object-contain"
            />
            <span className="truncate text-base font-semibold tracking-tight">
              {m['directory.brand_name']()}
            </span>
          </Link>
        </div>

        {/* Search Bar Input */}
        <div className="max-w-md min-w-0 flex-1">
          <button
            type="button"
            onClick={onSearchClick}
            aria-label={m['directory.search_placeholder']()}
            className="border-border bg-secondary/60 text-muted-foreground hover:bg-secondary flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-md border pr-2 pl-3.5 text-left text-sm transition"
          >
            <Search className="size-4 shrink-0" />
            <span className="text-muted-foreground/80 min-w-0 flex-1 truncate">
              {m['directory.search_placeholder']()}
            </span>
            <kbd className="border-border bg-card hidden shrink-0 rounded border px-1.5 py-0.5 font-sans text-[11px] sm:inline-block">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right Actions */}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {/* Submit Action */}
          <Link
            to="/submit"
            className="hover:bg-muted hover:text-foreground hidden h-8 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition md:inline-flex"
          >
            <Plus className="size-4" />
            <span>{m['directory.submit']()}</span>
          </Link>

          <div className="flex items-center gap-1">
            <LocaleSelector variant="icon" />
            <ThemeToggle />
          </div>

          {!authReady ? (
            <div
              className="bg-muted ml-1 size-8 animate-pulse rounded-full"
              aria-hidden
            />
          ) : user ? (
            <div className="ml-1">
              <SiteUserMenu
                name={user.name || 'User'}
                email={user.email}
                image={user.image}
              />
            </div>
          ) : (
            <Link
              to="/sign-in"
              className="bg-primary text-primary-foreground hover:bg-primary/90 ml-1 inline-flex h-8 items-center justify-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-all"
            >
              {m['directory.sign_in']()}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
