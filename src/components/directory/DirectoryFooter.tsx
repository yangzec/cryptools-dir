import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';

import {
  getDirectoryCategoriesFn,
  getDirectoryToolsFn,
} from '@/modules/directory/server';
import { FOOTER_NAV, tr } from '@/lib/directory-data';
import { m } from '@/paraglide/messages.js';
import { getLocale } from '@/paraglide/runtime.js';

type FooterLink = { label: string; href: string };

export function DirectoryFooter() {
  const [popularCategories, setPopularCategories] = useState<FooterLink[]>([]);
  const [popularTools, setPopularTools] = useState<FooterLink[]>([]);

  useEffect(() => {
    let cancelled = false;
    const locale = getLocale();
    Promise.all([
      getDirectoryCategoriesFn({ data: { locale } }),
      getDirectoryToolsFn({
        data: { locale, sort: 'recommended', pageSize: 6 },
      }),
    ])
      .then(([categories, toolsResult]) => {
        if (cancelled) return;
        const cats = (categories || []).slice(0, 6).map((c: any) => ({
          label: c.name || c.slug,
          href: `/categories/${c.slug}`,
        }));
        const tools = (toolsResult?.items || []).map((t: any) => ({
          label: t.name || t.slug,
          href: `/tools/${t.slug}`,
        }));
        setPopularCategories(cats);
        setPopularTools(tools);
      })
      .catch(() => {
        if (!cancelled) {
          setPopularCategories([]);
          setPopularTools([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <footer className="border-border bg-muted/20 mt-12 border-t">
      <div className="mx-auto max-w-[1320px] px-4 py-8 sm:px-6 lg:px-8">
        {/* Large Slogan */}
        <p className="text-foreground font-serif text-3xl leading-snug tracking-tight text-balance italic sm:text-4xl">
          {m['directory.footer_slogan']()}
        </p>

        {/* 5-Column Navigation */}
        <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-5 lg:gap-x-8">
          {/* Directory */}
          <nav
            aria-label={m['directory.footer.directory']()}
            className="min-w-0"
          >
            <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">
              {m['directory.footer.directory']()}
            </p>
            <ul className="space-y-2">
              {FOOTER_NAV.directory.map((item) => (
                <li key={item.labelKey}>
                  <Link
                    to={item.href as any}
                    className="text-muted-foreground hover:text-foreground text-sm leading-relaxed transition-colors hover:underline hover:underline-offset-4"
                  >
                    {tr(item.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Resources */}
          <nav
            aria-label={m['directory.footer.resources']()}
            className="min-w-0"
          >
            <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">
              {m['directory.footer.resources']()}
            </p>
            <ul className="space-y-2">
              {FOOTER_NAV.resources.map((item) => (
                <li key={item.labelKey}>
                  <Link
                    to={item.href as any}
                    className="text-muted-foreground hover:text-foreground text-sm leading-relaxed transition-colors hover:underline hover:underline-offset-4"
                  >
                    {tr(item.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Popular Categories */}
          <nav
            aria-label={m['directory.footer.popular_categories']()}
            className="min-w-0"
          >
            <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">
              {m['directory.footer.popular_categories']()}
            </p>
            <ul className="space-y-2">
              {popularCategories.map((item) => (
                <li key={item.href}>
                  <Link
                    to={item.href as any}
                    className="text-muted-foreground hover:text-foreground text-sm leading-relaxed transition-colors hover:underline hover:underline-offset-4"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  to={'/categories' as any}
                  className="text-muted-foreground hover:text-foreground text-sm leading-relaxed transition-colors hover:underline hover:underline-offset-4"
                >
                  {m['directory.nav.more_categories']()}
                </Link>
              </li>
            </ul>
          </nav>

          {/* Popular Tools */}
          <nav
            aria-label={m['directory.footer.popular_tools']()}
            className="min-w-0"
          >
            <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">
              {m['directory.footer.popular_tools']()}
            </p>
            <ul className="space-y-2">
              {popularTools.map((item) => (
                <li key={item.href}>
                  <Link
                    to={item.href as any}
                    className="text-muted-foreground hover:text-foreground text-sm leading-relaxed transition-colors hover:underline hover:underline-offset-4"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  to={'/tools' as any}
                  className="text-muted-foreground hover:text-foreground text-sm leading-relaxed transition-colors hover:underline hover:underline-offset-4"
                >
                  {m['directory.nav.more_tools']()}
                </Link>
              </li>
            </ul>
          </nav>

          {/* Legal */}
          <nav aria-label={m['directory.footer.legal']()} className="min-w-0">
            <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">
              {m['directory.footer.legal']()}
            </p>
            <ul className="space-y-2">
              {FOOTER_NAV.legal.map((item) => (
                <li key={item.labelKey}>
                  <Link
                    to={item.href as any}
                    className="text-muted-foreground hover:text-foreground text-sm leading-relaxed transition-colors hover:underline hover:underline-offset-4"
                  >
                    {tr(item.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-border border-t">
        <div className="text-muted-foreground mx-auto flex max-w-[1320px] flex-wrap items-center gap-x-2 gap-y-2 px-4 py-5 text-xs sm:px-6 lg:px-8">
          <span>{m['directory.copyright']()}</span>
          <span>
            {m['directory.built_with_prefix']()}
            <a
              href="https://shipany.ai/?utm_source=dir.shipany.site&utm_medium=referral&utm_campaign=attribution&utm_content=footer"
              target="_blank"
              rel="nofollow noopener noreferrer"
              className="text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              ShipAny
            </a>
            {m['directory.built_with_suffix']()}
          </span>
        </div>
      </div>
    </footer>
  );
}
