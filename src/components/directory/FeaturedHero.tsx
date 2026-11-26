import { Link } from '@tanstack/react-router';
import {
  ArrowRight,
  ChevronRight,
  Code,
  Image as ImageIcon,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react';

import { m } from '@/paraglide/messages.js';

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  coding: Code,
  chatbots: MessageSquare,
  image: ImageIcon,
};

const HERO_CATEGORY_SLUGS = ['coding', 'chatbots', 'image'] as const;

interface FeaturedHeroProps {
  hero?: {
    name: string;
    slug: string;
    tagline?: string | null;
    iconUrl?: string | null;
  } | null;
  categories?: Array<{
    slug: string;
    name: string;
    description?: string | null;
  }>;
}

export function FeaturedHero({
  hero = null,
  categories = [],
}: FeaturedHeroProps) {
  const categoryCards = HERO_CATEGORY_SLUGS.map((slug) => {
    const cat = categories.find((c) => c.slug === slug);
    if (!cat) return null;
    return {
      slug,
      name: cat.name,
      desc: cat.description || '',
      icon: CATEGORY_ICONS[slug] || Code,
    };
  }).filter(Boolean) as Array<{
    slug: string;
    name: string;
    desc: string;
    icon: LucideIcon;
  }>;

  if (!hero && categoryCards.length === 0) return null;

  return (
    <section>
      <div className="flex items-baseline justify-between gap-4 pb-3">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <h2 className="text-lg font-semibold tracking-tight">
            {m['directory.featured']()}
          </h2>
        </div>
        <Link
          to={'/tools' as any}
          className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1 text-[13px] font-medium transition"
        >
          {m['directory.view_all']()}
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        {hero ? (
          <div className="border-border from-primary/12 via-card to-card relative overflow-hidden rounded-2xl border bg-gradient-to-br p-6 sm:p-8">
            <div
              aria-hidden="true"
              className="text-primary/25 absolute inset-y-0 right-0 w-1/2 [mask-image:linear-gradient(to_left,black,transparent)]"
              style={{
                backgroundImage:
                  'radial-gradient(currentColor 1px, transparent 1px)',
                backgroundSize: '14px 14px',
              }}
            />
            <div className="relative flex items-start gap-6">
              <div className="min-w-0 flex-1">
                <span className="bg-primary/12 text-primary inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold">
                  {m['directory.editors_pick']()}
                </span>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                  {hero.name}
                </h3>
                {hero.tagline ? (
                  <p className="text-muted-foreground mt-2 max-w-md text-sm leading-relaxed sm:text-[15px]">
                    {hero.tagline}
                  </p>
                ) : null}
                <div className="mt-6 flex flex-wrap gap-2">
                  <Link
                    to={`/tools/${hero.slug}` as any}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-8 items-center justify-center gap-1 rounded-full px-4 text-sm font-medium transition-all"
                  >
                    <span>{m['directory.view_details']()}</span>
                    <ChevronRight className="size-3.5" />
                  </Link>
                </div>
              </div>

              {hero.iconUrl ? (
                <div className="border-border/60 bg-card hidden size-24 shrink-0 rotate-6 overflow-hidden rounded-2xl border shadow-xl shadow-black/10 sm:block">
                  <img
                    src={hero.iconUrl}
                    alt=""
                    width={96}
                    height={96}
                    className="size-full object-cover"
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="border-border bg-card hidden rounded-2xl border lg:block" />
        )}

        {categoryCards.length > 0 ? (
          <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-1">
            {categoryCards.map((cat) => {
              const Icon = cat.icon;
              return (
                <Link
                  key={cat.slug}
                  to={'/tools' as any}
                  search={{ category: cat.slug } as any}
                  className="group border-border bg-card hover:border-primary/35 flex items-center gap-3.5 rounded-2xl border p-4 transition"
                >
                  <span className="bg-primary/10 text-primary grid size-11 shrink-0 place-items-center rounded-xl">
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{cat.name}</p>
                    {cat.desc ? (
                      <p className="text-muted-foreground truncate text-[13px]">
                        {cat.desc}
                      </p>
                    ) : null}
                  </div>
                  <ChevronRight className="text-muted-foreground group-hover:text-primary size-4 shrink-0 transition" />
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}
