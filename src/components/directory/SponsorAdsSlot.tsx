import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowUpRight, Megaphone } from 'lucide-react';

import { getActiveSponsorAdsFn } from '@/modules/directory/server';
import type { ActiveSponsorAd } from '@/modules/directory/service';
import type { SponsorPlacement } from '@/lib/directory/sponsor-placement';
import { SPONSOR_TIER_STYLES } from '@/lib/directory/sponsor-tier-styles';
import { withDirectoryUtm } from '@/lib/directory/structured-data';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { DirectoryListIcon } from '@/components/directory/DirectoryListIcon';

interface SponsorAdsSlotProps {
  limit?: number;
  className?: string;
  /** listing = home/list pages (gold+platinum); detail = tool pages (all tiers). */
  placement?: SponsorPlacement;
}

export function SponsorAdsSlot({
  limit = 4,
  className,
  placement = 'detail',
}: SponsorAdsSlotProps) {
  const [ads, setAds] = useState<ActiveSponsorAd[]>([]);

  useEffect(() => {
    let cancelled = false;
    getActiveSponsorAdsFn({ data: { limit, placement } })
      .then((items) => {
        if (!cancelled && Array.isArray(items)) setAds(items);
      })
      .catch(() => {
        if (!cancelled) setAds([]);
      });
    return () => {
      cancelled = true;
    };
  }, [limit, placement]);

  return (
    <div className={className || 'space-y-2'}>
      <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-[0.18em] uppercase">
        {m['directory.detail.sponsors']()}
      </p>
      {ads.map((ad) => {
        const style =
          SPONSOR_TIER_STYLES[ad.tier] || SPONSOR_TIER_STYLES.silver;
        const TierIcon = style.icon;
        return (
          <a
            key={ad.id}
            href={withDirectoryUtm(ad.url)}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className={cn(
              'group relative flex items-start gap-3 rounded-xl border p-3 transition',
              style.card
            )}
          >
            <span
              className="text-muted-foreground absolute top-2.5 right-2.5 flex items-center gap-0.5 text-[10px] font-semibold tracking-[0.12em] uppercase"
              title={ad.tier}
            >
              {m['dir.sponsor.tag_sponsor']()}
              <TierIcon className={cn('size-3', style.iconClass)} />
            </span>
            <DirectoryListIcon src={ad.iconUrl} alt={ad.name} size={32} />
            <span className="min-w-0 flex-1 pr-14">
              <span className="flex items-center gap-1 text-sm leading-tight font-semibold">
                <span className="truncate">{ad.name}</span>
                <ArrowUpRight className="text-muted-foreground size-3.5 shrink-0 opacity-0 transition group-hover:opacity-100" />
              </span>
              {ad.tagline ? (
                <span className="text-muted-foreground mt-1 line-clamp-2 block text-xs leading-4">
                  {ad.tagline}
                </span>
              ) : null}
            </span>
          </a>
        );
      })}
      <Link
        to={'/advertise' as any}
        className="border-border text-muted-foreground hover:text-foreground hover:border-primary/35 block rounded-xl border border-dashed p-4 text-[13px] transition"
      >
        <span className="text-foreground flex items-center gap-1.5 font-medium">
          <Megaphone className="size-3.5" />
          {m['directory.detail.advertise_here']()}
        </span>
        <span className="mt-1 block text-xs">
          {m['directory.detail.advertise_desc']()}
        </span>
      </Link>
    </div>
  );
}
