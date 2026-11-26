import { Link } from '@tanstack/react-router';
import {
  Activity,
  BookOpen,
  Compass,
  Hash,
  Layers,
  LayoutGrid,
  Megaphone,
  Plus,
  Shapes,
  X,
} from 'lucide-react';

import { usePathname } from '@/core/i18n/navigation';
import { SITE_CONFIG } from '@/lib/directory-data';
import { m } from '@/paraglide/messages.js';

interface DirectorySidebarProps {
  mobileOpen?: boolean;
  /** Desktop sticky rail; default true so lg+ keeps the always-on nav. */
  desktopOpen?: boolean;
  onMobileClose?: () => void;
}

function isNavActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DirectorySidebar({
  mobileOpen,
  desktopOpen = true,
  onMobileClose,
}: DirectorySidebarProps) {
  const pathname = usePathname();

  const browseLinks = [
    {
      label: m['directory.nav.discover'](),
      href: '/',
      icon: Compass,
    },
    { label: m['directory.nav.tools'](), href: '/tools', icon: LayoutGrid },
    {
      label: m['directory.nav.categories'](),
      href: '/categories',
      icon: Shapes,
    },
    {
      label: m['directory.nav.collections'](),
      href: '/collections',
      icon: Layers,
    },
    { label: m['directory.nav.tags'](), href: '/tags', icon: Hash },
    { label: m['directory.nav.feed'](), href: '/feed', icon: Activity },
  ];

  const moreLinks = [
    { label: m['directory.nav.blog'](), href: '/blog', icon: BookOpen },
    { label: m['directory.nav.submit'](), href: '/submit', icon: Plus },
    {
      label: m['directory.nav.for_makers'](),
      href: '/advertise',
      icon: Megaphone,
    },
  ];

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Brand Header */}
      <div className="mb-6 flex items-center justify-between px-3">
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
        {mobileOpen && (
          <button
            type="button"
            onClick={onMobileClose}
            aria-label={m['directory.close_menu']()}
            className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-md p-1.5 lg:hidden"
          >
            <X className="size-5" />
          </button>
        )}
      </div>

      {/* Nav Lists */}
      <div className="flex min-h-0 flex-1 flex-col">
        <nav className="flex-1 space-y-5 overflow-y-auto">
          <div>
            <p className="text-sidebar-foreground/55 mb-1.5 px-3 text-[11px] font-semibold tracking-[0.14em] uppercase">
              {m['directory.browse']()}
            </p>
            <ul className="space-y-0.5">
              {browseLinks.map((item) => {
                const Icon = item.icon;
                const active = isNavActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      to={item.href}
                      onClick={onMobileClose}
                      aria-current={active ? 'page' : undefined}
                      className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition ${
                        active
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                          : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
                      }`}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <p className="text-sidebar-foreground/55 mb-1.5 px-3 text-[11px] font-semibold tracking-[0.14em] uppercase">
              {m['directory.more']()}
            </p>
            <ul className="space-y-0.5">
              {moreLinks.map((item) => {
                const Icon = item.icon;
                const active = isNavActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      to={item.href}
                      onClick={onMobileClose}
                      aria-current={active ? 'page' : undefined}
                      className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition ${
                        active
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                          : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
                      }`}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        {/* Submit Callout Card */}
        <div className="border-sidebar-border bg-sidebar-accent/40 mt-4 rounded-lg border p-3.5">
          <p className="text-sidebar-foreground text-sm font-semibold">
            {m['directory.submit_banner_title']()}
          </p>
          <p className="text-sidebar-foreground/65 mt-1 text-xs leading-relaxed">
            {m['directory.submit_banner_desc']()}
          </p>
          <Link
            to="/submit"
            onClick={onMobileClose}
            className="bg-primary text-primary-foreground hover:bg-primary/90 mt-3 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-full px-2.5 text-sm font-medium transition-all"
          >
            <Plus className="size-3.5" />
            <span>{m['directory.submit']()}</span>
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside
        className={`border-sidebar-border bg-sidebar text-sidebar-foreground sticky top-0 h-screen w-[240px] shrink-0 flex-col border-r px-3 py-4 ${
          desktopOpen ? 'hidden lg:flex' : 'hidden'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={onMobileClose}
          />
          <div className="bg-sidebar text-sidebar-foreground animate-in slide-in-from-left fixed inset-y-0 left-0 w-[270px] max-w-[85vw] p-4 shadow-xl duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
