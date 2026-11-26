import { Award, Crown, Medal, type LucideIcon } from 'lucide-react';

import type { SponsorTierId } from '@/lib/directory/sponsor-placement';

/** Matches /advertise live card preview for each paid tier. */
export const SPONSOR_TIER_STYLES: Record<
  SponsorTierId,
  { icon: LucideIcon; iconClass: string; card: string }
> = {
  platinum: {
    icon: Crown,
    iconClass: 'text-violet-500',
    card: 'border-violet-200 bg-violet-50/70 hover:border-violet-300 dark:border-violet-500/30 dark:bg-violet-500/10',
  },
  gold: {
    icon: Medal,
    iconClass: 'text-amber-500',
    card: 'border-amber-200 bg-amber-50/70 hover:border-amber-300 dark:border-amber-500/30 dark:bg-amber-500/10',
  },
  silver: {
    icon: Award,
    iconClass: 'text-slate-400',
    card: 'border-border bg-card hover:border-primary/35',
  },
};
