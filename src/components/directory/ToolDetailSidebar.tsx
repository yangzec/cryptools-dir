import { Link } from '@tanstack/react-router';

import { m } from '@/paraglide/messages.js';
import { SponsorAdsSlot } from '@/components/directory/SponsorAdsSlot';

type PopularTool = {
  slug: string;
  name: string;
  tagline?: string | null;
  iconUrl?: string | null;
};

export function ToolDetailSidebar({ topPicks }: { topPicks: PopularTool[] }) {
  return (
    <aside className="directory-detail-sidebar-sticky space-y-3 self-start lg:sticky lg:pt-2">
      <SponsorAdsSlot placement="detail" limit={4} />

      {/* Popular Tools List */}
      {topPicks.length > 0 && (
        <section className="pt-6">
          <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-[0.18em] uppercase">
            {m['directory.detail.popular_tools']()}
          </p>
          <ol className="space-y-2">
            {topPicks.slice(0, 5).map((pTool, index) => {
              const rank = index + 1;
              return (
                <li key={pTool.slug}>
                  <Link
                    to={`/tools/${pTool.slug}` as any}
                    className="border-border bg-card hover:border-primary/35 flex items-center gap-3 rounded-xl border px-3 py-2.5 transition"
                  >
                    <span
                      className={`w-4 shrink-0 text-center text-sm font-semibold tabular-nums ${
                        rank <= 3 ? 'text-primary' : 'text-muted-foreground'
                      }`}
                    >
                      {rank}
                    </span>
                    <div
                      className="border-border/60 bg-secondary/50 shrink-0 overflow-hidden rounded-lg border"
                      style={{ width: 32, height: 32 }}
                    >
                      {pTool.iconUrl ? (
                        <img
                          src={pTool.iconUrl}
                          alt=""
                          width={32}
                          height={32}
                          className="size-full object-cover"
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {pTool.name}
                      </p>
                      {pTool.tagline && (
                        <p className="text-muted-foreground truncate text-xs">
                          {pTool.tagline}
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </aside>
  );
}
