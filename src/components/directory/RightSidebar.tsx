import { Link } from '@tanstack/react-router';

import { m } from '@/paraglide/messages.js';
import { SponsorAdsSlot } from '@/components/directory/SponsorAdsSlot';

interface RightSidebarProps {
  onTagClick?: (tag: string) => void;
  topPicks?: Array<{
    slug: string;
    name: string;
    tagline?: string | null;
    iconUrl?: string | null;
  }>;
  tags?: Array<{
    slug: string;
    name: string;
  }>;
}

export function RightSidebar({
  onTagClick,
  topPicks = [],
  tags = [],
}: RightSidebarProps) {
  return (
    <aside className="space-y-8 xl:sticky xl:top-[calc(3.5rem+1.5rem)] xl:self-start">
      <SponsorAdsSlot placement="listing" limit={4} />

      {/* Top Picks Section */}
      <section>
        <div className="flex flex-col items-start gap-0.5 pb-3">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <h2 className="text-lg font-semibold tracking-tight">
              {m['directory.top_picks']()}
            </h2>
          </div>
        </div>
        <p className="text-muted-foreground -mt-2 mb-3 text-[13px]">
          {m['directory.top_picks_desc']()}
        </p>
        <ol className="space-y-2">
          {topPicks.map((tool, index) => {
            const rank = index + 1;
            return (
              <li key={tool.slug}>
                <Link
                  to={`/tools/${tool.slug}` as any}
                  className="border-border bg-card hover:border-primary/35 flex items-center gap-3 rounded-xl border px-3 py-2.5 transition"
                >
                  <span
                    className={`w-4 shrink-0 text-center text-sm font-semibold tabular-nums ${
                      rank <= 3 ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    {rank}
                  </span>
                  <div className="border-border/60 bg-secondary/50 size-8 shrink-0 overflow-hidden rounded-lg border">
                    <img
                      src={tool.iconUrl || undefined}
                      alt=""
                      width={32}
                      height={32}
                      className="size-full object-cover"
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {tool.name}
                    </p>
                    {tool.tagline ? (
                      <p className="text-muted-foreground truncate text-xs">
                        {tool.tagline}
                      </p>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Popular Tags Section */}
      <section>
        <div className="flex items-baseline justify-between gap-4 pb-3">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <h2 className="text-lg font-semibold tracking-tight">
              {m['directory.popular_tags']()}
            </h2>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Link
              key={tag.slug}
              to={'/tools' as any}
              search={{ tag: tag.slug } as any}
              onClick={(e) => {
                if (onTagClick) {
                  e.preventDefault();
                  onTagClick(tag.slug);
                }
              }}
              className="bg-secondary text-secondary-foreground hover:bg-primary/10 hover:text-primary inline-flex h-8 cursor-pointer items-center rounded-full px-3.5 text-sm font-medium transition"
            >
              #{tag.name || tag.slug}
            </Link>
          ))}
        </div>
      </section>
    </aside>
  );
}
