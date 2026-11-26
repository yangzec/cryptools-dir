export type SponsorPlacement = 'listing' | 'detail';

export type SponsorTierId = 'platinum' | 'gold' | 'silver';

/** Lower = higher priority (platinum first). */
export const SPONSOR_TIER_RANK: Record<SponsorTierId, number> = {
  platinum: 0,
  gold: 1,
  silver: 2,
};

/**
 * Platinum/gold: homepage + list page sponsor slots.
 * Silver: tool detail pages only.
 * Detail pages include all three; platinum always first.
 */
export function tiersForPlacement(
  placement: SponsorPlacement
): readonly SponsorTierId[] {
  if (placement === 'listing') return ['platinum', 'gold'] as const;
  return ['platinum', 'gold', 'silver'] as const;
}
