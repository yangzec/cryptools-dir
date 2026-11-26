import { useEffect, useRef, useState } from 'react';

export interface SectionTabItem {
  id: string;
  label: string;
}

interface StickySectionNavProps {
  tabs: SectionTabItem[];
}

/** Site header is `top-14` / h-14; sticky tabs sit below it. */
const HEADER_OFFSET_PX = 56;

function stickyOffsetPx(nav: HTMLElement | null) {
  return HEADER_OFFSET_PX + (nav?.offsetHeight || 48);
}

export function StickySectionNav({ tabs }: StickySectionNavProps) {
  const [activeTab, setActiveTab] = useState<string>(tabs[0]?.id || '');
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (tabs.length === 0) return;

    const top = stickyOffsetPx(navRef.current);
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries.find((entry) => entry.isIntersecting);
        if (visibleEntry) {
          setActiveTab(visibleEntry.target.id);
        }
      },
      {
        rootMargin: `-${top}px 0px -55% 0px`,
        threshold: 0,
      }
    );

    tabs.forEach((tab) => {
      const el = document.getElementById(tab.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [tabs]);

  const handleTabClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    id: string
  ) => {
    e.preventDefault();
    setActiveTab(id);
    const el = document.getElementById(id);
    if (!el) return;
    const top =
      window.scrollY +
      el.getBoundingClientRect().top -
      stickyOffsetPx(navRef.current);
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    window.history.replaceState(null, '', `#${id}`);
  };

  if (tabs.length <= 1) return null;

  return (
    <nav
      ref={navRef}
      className="bg-background/90 border-border scrollbar-none sticky top-14 z-20 -mx-4 mb-8 flex gap-1 overflow-x-auto border-b px-4 backdrop-blur sm:mx-0 sm:px-0"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <a
            key={tab.id}
            href={`#${tab.id}`}
            onClick={(e) => handleTabClick(e, tab.id)}
            aria-current={isActive ? 'location' : undefined}
            className={`relative shrink-0 px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:transition-colors ${
              isActive
                ? 'text-primary after:bg-primary font-semibold'
                : 'text-muted-foreground hover:text-foreground after:bg-transparent'
            }`}
          >
            {tab.label}
          </a>
        );
      })}
    </nav>
  );
}
