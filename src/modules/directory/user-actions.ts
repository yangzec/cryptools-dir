import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';

import { db } from '@/core/db';
import { atomic, AtomicGuardError, guard } from '@/core/db/atomic';
import {
  directoryCategory,
  directoryCategoryTranslation,
  directorySponsorAd,
  directoryTool,
  directoryToolTranslation,
  order,
  subscription,
} from '@/config/db/schema';
import { directoryAdOrderReference } from '@/modules/directory/payment';
import { SubscriptionStatus } from '@/modules/subscriptions/service';
import {
  SPONSOR_PENDING_PAYMENT_TTL_MS,
  SPONSOR_TIERS,
  SUBMIT_TIERS,
} from '@/lib/directory/submit-sponsor-config';
import { getUuid } from '@/lib/hash';

export { SPONSOR_PENDING_PAYMENT_TTL_MS };

export type MySubmissionItem = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  iconUrl: string;
  websiteUrl: string;
  categoryName: string;
  status: 'published' | 'pending' | 'pending_payment' | 'rejected';
  featured?: boolean;
  featuredUntil?: string;
  paidAt?: string;
  plan?: string | null;
  createdAt: string;
};

export type MySponsorAdItem = {
  id: string;
  name: string;
  tagline: string;
  url: string;
  iconUrl: string;
  tier: 'platinum' | 'gold' | 'silver';
  status: 'active' | 'pending_payment' | 'expired';
  startsAt: string;
  endsAt: string;
  createdAt: string;
};

function slugify(input: string) {
  const base = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || `tool-${Date.now().toString(36)}`;
}

function faviconForUrl(websiteUrl: string) {
  try {
    const host = new URL(websiteUrl).hostname;
    return `https://www.google.com/s2/favicons?domain=${host}&sz=128`;
  } catch {
    return '';
  }
}

async function uniqueToolSlug(name: string) {
  const base = slugify(name);
  let candidate = base;
  for (let i = 0; i < 20; i++) {
    const existing = await db()
      .select({ id: directoryTool.id })
      .from(directoryTool)
      .where(eq(directoryTool.slug, candidate))
      .limit(1);
    if (!existing[0]) return candidate;
    candidate = `${base}-${i + 2}`;
  }
  return `${base}-${getUuid().slice(0, 8)}`;
}

export async function submitDirectoryTool(params: {
  userId: string;
  authorName?: string | null;
  name: string;
  websiteUrl: string;
  tagline: string;
  categoryId: string;
  description?: string;
  plan: 'free' | 'premium';
  locale?: string;
}) {
  const name = params.name.trim();
  const websiteUrl = params.websiteUrl.trim();
  const tagline = params.tagline.trim();
  const categoryId = params.categoryId.trim();
  const plan = params.plan === 'premium' ? 'premium' : 'free';

  if (!name || !websiteUrl || !tagline || !categoryId) {
    throw new Error('Missing required fields');
  }
  try {
    // Validate URL
    // eslint-disable-next-line no-new
    new URL(websiteUrl);
  } catch {
    throw new Error('Invalid website URL');
  }

  const [category] = await db()
    .select({ id: directoryCategory.id })
    .from(directoryCategory)
    .where(eq(directoryCategory.id, categoryId))
    .limit(1);
  if (!category) throw new Error('Invalid category');

  const tier = SUBMIT_TIERS.find((t) => t.id === plan) || SUBMIT_TIERS[0];
  const slug = await uniqueToolSlug(name);
  const id = getUuid();
  const locale = params.locale?.startsWith('zh') ? 'zh' : 'en';
  const iconUrl = faviconForUrl(websiteUrl);
  const now = new Date();

  // Free → pending review; paid → pending payment until checkout completes.
  const status = plan === 'premium' ? 'pending_payment' : 'pending';

  await db()
    .insert(directoryTool)
    .values({
      id,
      slug,
      iconUrl: iconUrl || null,
      websiteUrl,
      pricing: 'free',
      authorName: params.authorName || null,
      categoryId,
      screenshots: null,
      source: 'community',
      plan,
      submittedBy: params.userId,
      featured: false,
      featuredUntil: null,
      sponsored: false,
      sort: 0,
      status,
      publishedAt: null,
      createdAt: now,
      updatedAt: now,
    });

  const introduction = params.description?.trim() || null;
  await db()
    .insert(directoryToolTranslation)
    .values({
      id: `${id}-${locale}`,
      toolId: id,
      locale,
      name,
      tagline,
      introduction,
      howToUse: null,
      features: null,
      useCases: null,
      faqs: null,
      pros: null,
      cons: null,
      createdAt: now,
    });

  // Ensure EN row exists for listing fallbacks
  if (locale !== 'en') {
    await db()
      .insert(directoryToolTranslation)
      .values({
        id: `${id}-en`,
        toolId: id,
        locale: 'en',
        name,
        tagline,
        introduction,
        howToUse: null,
        features: null,
        useCases: null,
        faqs: null,
        pros: null,
        cons: null,
        createdAt: now,
      });
  }

  return {
    id,
    slug,
    status,
    plan,
    priceInCents: tier.priceInCents,
  };
}

export async function listMySubmissions(
  userId: string,
  locale = 'en'
): Promise<MySubmissionItem[]> {
  const normLocale = locale.startsWith('zh') ? 'zh' : 'en';

  const rows = await db()
    .select({
      id: directoryTool.id,
      slug: directoryTool.slug,
      iconUrl: directoryTool.iconUrl,
      websiteUrl: directoryTool.websiteUrl,
      status: directoryTool.status,
      featured: directoryTool.featured,
      featuredUntil: directoryTool.featuredUntil,
      plan: directoryTool.plan,
      createdAt: directoryTool.createdAt,
      name: directoryToolTranslation.name,
      tagline: directoryToolTranslation.tagline,
      categoryName: directoryCategoryTranslation.name,
    })
    .from(directoryTool)
    .leftJoin(
      directoryToolTranslation,
      and(
        eq(directoryToolTranslation.toolId, directoryTool.id),
        eq(directoryToolTranslation.locale, normLocale)
      )
    )
    .leftJoin(
      directoryCategory,
      eq(directoryCategory.id, directoryTool.categoryId)
    )
    .leftJoin(
      directoryCategoryTranslation,
      and(
        eq(directoryCategoryTranslation.categoryId, directoryCategory.id),
        eq(directoryCategoryTranslation.locale, normLocale)
      )
    )
    .where(eq(directoryTool.submittedBy, userId))
    .orderBy(desc(directoryTool.createdAt));

  return rows.map((row: any) => ({
    id: row.id,
    slug: row.slug,
    name: row.name || row.slug,
    tagline: row.tagline || '',
    iconUrl: row.iconUrl || '',
    websiteUrl: row.websiteUrl || '',
    categoryName: row.categoryName || '',
    status: row.status,
    featured: Boolean(row.featured),
    featuredUntil: row.featuredUntil
      ? new Date(row.featuredUntil).toISOString()
      : undefined,
    paidAt:
      row.plan === 'premium' && row.status !== 'pending_payment'
        ? new Date(row.createdAt).toISOString()
        : undefined,
    plan: row.plan,
    createdAt: new Date(row.createdAt).toISOString(),
  }));
}

/**
 * Release abandoned pending_payment holds past TTL so they stop occupying
 * inventory. Never-activated rows become expired (payment webhook can still
 * revive them via planDirectoryAdFulfillment).
 */
export async function releaseStalePendingSponsorAds(
  tier?: 'silver' | 'gold' | 'platinum'
) {
  // D1 rejects bound Date params in WHERE; compare epoch ms.
  const cutoffMs = Date.now() - SPONSOR_PENDING_PAYMENT_TTL_MS;
  const now = new Date();
  const nowMs = Date.now();
  const pendingConds = [
    eq(directorySponsorAd.status, 'pending_payment'),
    sql`${directorySponsorAd.createdAt} < ${cutoffMs}`,
  ];
  if (tier) pendingConds.push(eq(directorySponsorAd.tier, tier));
  await db()
    .update(directorySponsorAd)
    .set({ status: 'expired', updatedAt: now })
    .where(and(...pendingConds));

  // Natural / canceled period elapsed (or missed subscription.deleted webhook):
  // free inventory so soft-expired seats do not block rebook / tier_already_held.
  const endedConds = [
    eq(directorySponsorAd.status, 'active'),
    sql`${directorySponsorAd.endsAt} is not null`,
    sql`${directorySponsorAd.endsAt} < ${nowMs}`,
  ];
  if (tier) endedConds.push(eq(directorySponsorAd.tier, tier));
  await db()
    .update(directorySponsorAd)
    .set({ status: 'expired', updatedAt: now })
    .where(and(...endedConds));
}

/** Active + unpaid bookings that occupy a sponsor slot. */
export async function countSponsorTierUsed(
  tier: 'silver' | 'gold' | 'platinum'
) {
  const [row] = await db()
    .select({ n: count() })
    .from(directorySponsorAd)
    .where(
      and(
        eq(directorySponsorAd.tier, tier),
        inArray(directorySponsorAd.status, ['active', 'pending_payment'])
      )
    );
  return Number(row?.n || 0);
}

export async function getSponsorTierInventory() {
  // Drop abandoned holds before reporting remaining seats.
  await releaseStalePendingSponsorAds();
  const result = {} as Record<
    'silver' | 'gold' | 'platinum',
    { spots: number; left: number }
  >;
  for (const t of SPONSOR_TIERS) {
    const used = await countSponsorTierUsed(t.tier);
    result[t.tier] = {
      spots: t.spots,
      left: Math.max(0, t.spots - used),
    };
  }
  return result;
}

export async function createSponsorAd(params: {
  userId: string;
  name: string;
  tagline: string;
  url: string;
  iconUrl?: string;
  tier: 'silver' | 'gold' | 'platinum';
}) {
  const name = params.name.trim();
  const tagline = params.tagline.trim();
  const url = params.url.trim();
  const tier = params.tier;

  if (!name || !tagline || !url) {
    throw new Error('Missing required fields');
  }
  if (!['silver', 'gold', 'platinum'].includes(tier)) {
    throw new Error('Invalid sponsor tier');
  }
  try {
    // eslint-disable-next-line no-new
    new URL(url);
  } catch {
    throw new Error('Invalid URL');
  }

  const tierDef = SPONSOR_TIERS.find((t) => t.tier === tier);
  if (!tierDef) throw new Error('Invalid sponsor tier');

  // Drop abandoned holds across ALL tiers first. The pending_checkout check
  // is per-user (any tier); releasing only `tier` left stale holds on other
  // tiers blocking rebook until something else expired them.
  await releaseStalePendingSponsorAds();

  // Finish (or abandon via TTL) any unpaid hold before booking another seat.
  // Fast-path only — authoritative check is the atomic guard below.
  const [openCheckout] = await db()
    .select({ id: directorySponsorAd.id })
    .from(directorySponsorAd)
    .where(
      and(
        eq(directorySponsorAd.userId, params.userId),
        eq(directorySponsorAd.status, 'pending_payment')
      )
    )
    .limit(1);
  if (openCheckout) {
    throw new Error('pending_checkout');
  }

  // One live seat per user per tier. Scarce inventory + monthly auto-renew
  // make stacking the same tier look like duplicate subscription of one seat;
  // cross-tier (e.g. silver + gold) remains allowed.
  const [liveSameTier] = await db()
    .select({ id: directorySponsorAd.id })
    .from(directorySponsorAd)
    .where(
      and(
        eq(directorySponsorAd.userId, params.userId),
        eq(directorySponsorAd.tier, tier),
        inArray(directorySponsorAd.status, ['active', 'pending_payment'])
      )
    )
    .limit(1);
  if (liveSameTier) {
    throw new Error('tier_already_held');
  }

  // Ad may already be soft-expired (endsAt passed) while the Stripe sub is
  // still active/pending_cancel — block rebook to avoid double charging.
  const productId = `directory_sponsor_${tier}`;
  const [liveSub] = await db()
    .select({ id: subscription.id })
    .from(subscription)
    .where(
      and(
        eq(subscription.userId, params.userId),
        eq(subscription.productId, productId),
        inArray(subscription.status, [
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.TRIALING,
          SubscriptionStatus.PENDING_CANCEL,
        ])
      )
    )
    .limit(1);
  if (liveSub) {
    throw new Error('tier_already_held');
  }

  const id = getUuid();
  const now = new Date();
  const cutoffMs = Date.now() - SPONSOR_PENDING_PAYMENT_TTL_MS;
  // Only persist an uploaded logo; broken Google favicon guesses cause 404 noise
  // in settings/ads — the list UI falls back to a local SVG placeholder.
  const iconUrl = params.iconUrl?.trim() || null;

  // One atomic write: release abandoned holds, insert the new hold, then
  // postcondition guards so concurrent checkouts cannot oversell, stack
  // unpaid seats, or double-hold the same tier for one user.
  try {
    const nowMs = now.getTime();
    await atomic((q) => [
      // Inventory: free timed-out holds on this tier (any user).
      q
        .update(directorySponsorAd)
        .set({ status: 'expired', updatedAt: now })
        .where(
          and(
            eq(directorySponsorAd.tier, tier),
            eq(directorySponsorAd.status, 'pending_payment'),
            sql`${directorySponsorAd.createdAt} < ${cutoffMs}`
          )
        ),
      // Past endsAt still marked active (period ended / missed webhook).
      q
        .update(directorySponsorAd)
        .set({ status: 'expired', updatedAt: now })
        .where(
          and(
            eq(directorySponsorAd.tier, tier),
            eq(directorySponsorAd.status, 'active'),
            sql`${directorySponsorAd.endsAt} is not null`,
            sql`${directorySponsorAd.endsAt} < ${nowMs}`
          )
        ),
      // This user: free their timed-out holds on other tiers too, so a stale
      // gold row cannot race past the fast-path and trip pending_checkout.
      q
        .update(directorySponsorAd)
        .set({ status: 'expired', updatedAt: now })
        .where(
          and(
            eq(directorySponsorAd.userId, params.userId),
            eq(directorySponsorAd.status, 'pending_payment'),
            sql`${directorySponsorAd.createdAt} < ${cutoffMs}`
          )
        ),
      q.insert(directorySponsorAd).values({
        id,
        userId: params.userId,
        name,
        tagline,
        url,
        iconUrl,
        tier,
        status: 'pending_payment',
        startsAt: null,
        endsAt: null,
        createdAt: now,
        updatedAt: now,
      }),
      guard({
        table: directorySponsorAd,
        column: 'userId',
        where: eq(directorySponsorAd.id, id),
        require: sql`(
          select count(*) from ${directorySponsorAd}
          where ${directorySponsorAd.tier} = ${tier}
            and ${directorySponsorAd.status} in ('active', 'pending_payment')
        ) <= ${tierDef.spots}`,
        message: 'sold_out',
      }),
      // After insert, this user must have at most one unpaid hold (the new row).
      guard({
        table: directorySponsorAd,
        column: 'userId',
        where: eq(directorySponsorAd.id, id),
        require: sql`(
          select count(*) from ${directorySponsorAd}
          where ${directorySponsorAd.userId} = ${params.userId}
            and ${directorySponsorAd.status} = 'pending_payment'
        ) <= 1`,
        message: 'pending_checkout',
      }),
      // After insert, this user may hold at most one live seat of this tier.
      guard({
        table: directorySponsorAd,
        column: 'userId',
        where: eq(directorySponsorAd.id, id),
        require: sql`(
          select count(*) from ${directorySponsorAd}
          where ${directorySponsorAd.userId} = ${params.userId}
            and ${directorySponsorAd.tier} = ${tier}
            and ${directorySponsorAd.status} in ('active', 'pending_payment')
        ) <= 1`,
        message: 'tier_already_held',
      }),
    ]);
  } catch (error) {
    if (error instanceof AtomicGuardError) {
      // Preserve sold_out / pending_checkout / tier_already_held.
      throw new Error(error.message || 'sold_out');
    }
    throw error;
  }

  return {
    id,
    status: 'pending_payment' as const,
    tier,
    priceInCents: tierDef.priceInCents,
  };
}

/**
 * User cancels an unpaid sponsor booking (settings/ads「取消付款」).
 * 1) Expire open provider Checkout Sessions (Stripe) so a stale hosted URL
 *    cannot still charge after we abandon locally.
 * 2) Atomically mark open orders canceled + release the inventory hold.
 * 3) Best-effort cancel any rare pre-attached subscription; local abandon
 *    already succeeded — provider sub failures are logged, not thrown.
 */
export async function cancelPendingSponsorAdPayment(params: {
  userId: string;
  adId: string;
}) {
  const [ad] = await db()
    .select()
    .from(directorySponsorAd)
    .where(
      and(
        eq(directorySponsorAd.id, params.adId),
        eq(directorySponsorAd.userId, params.userId)
      )
    )
    .limit(1);
  if (!ad) throw new Error('Ad not found');
  if (ad.status !== 'pending_payment') {
    throw new Error('not_pending');
  }

  const reference = directoryAdOrderReference(ad.id);
  type RelatedOrder = {
    id: string;
    status: string;
    subscriptionNo: string | null;
    paymentProvider: string | null;
    paymentSessionId: string | null;
  };
  const relatedOrders: RelatedOrder[] = await db()
    .select({
      id: order.id,
      status: order.status,
      subscriptionNo: order.subscriptionNo,
      paymentProvider: order.paymentProvider,
      paymentSessionId: order.paymentSessionId,
    })
    .from(order)
    .where(
      and(eq(order.reference, reference), eq(order.userId, params.userId))
    );

  // Already paid → this seat is no longer a pending checkout; use billing cancel.
  if (relatedOrders.some((o) => o.status === 'paid')) {
    throw new Error('already_paid');
  }

  let openOrders = relatedOrders.filter(
    (o) => o.status === 'created' || o.status === 'pending'
  );

  // Close hosted checkouts first — otherwise settle skips canceled orders and
  // the customer can still pay with nothing fulfilled. If any session is
  // already complete, abort: canceling would drop fulfillment for money taken.
  const { expireOpenCheckoutSessions } =
    await import('@/modules/payment/service');
  const { alreadyComplete } = await expireOpenCheckoutSessions(openOrders);
  if (alreadyComplete) {
    throw new Error('already_paid');
  }

  // Re-read after provider calls — webhook may have settled during expire.
  const refreshedOrders: RelatedOrder[] = await db()
    .select({
      id: order.id,
      status: order.status,
      subscriptionNo: order.subscriptionNo,
      paymentProvider: order.paymentProvider,
      paymentSessionId: order.paymentSessionId,
    })
    .from(order)
    .where(
      and(eq(order.reference, reference), eq(order.userId, params.userId))
    );
  if (refreshedOrders.some((o) => o.status === 'paid')) {
    throw new Error('already_paid');
  }
  openOrders = refreshedOrders.filter(
    (o) => o.status === 'created' || o.status === 'pending'
  );

  const now = new Date();
  try {
    await atomic((q) => [
      // Refuse if a related order is already paid (webhook race).
      guard({
        table: directorySponsorAd,
        column: 'userId',
        where: eq(directorySponsorAd.id, ad.id),
        require: sql`(
          select count(*) from ${order}
          where ${order.reference} = ${reference}
            and ${order.userId} = ${params.userId}
            and ${order.status} = 'paid'
        ) = 0`,
        message: 'already_paid',
      }),
      // Seat must still be an unpaid hold.
      guard({
        table: directorySponsorAd,
        column: 'userId',
        where: eq(directorySponsorAd.id, ad.id),
        require: eq(directorySponsorAd.status, 'pending_payment'),
        message: 'not_pending',
      }),
      q
        .update(order)
        .set({
          status: 'canceled',
          checkoutUrl: null,
          updatedAt: now,
        })
        .where(
          and(
            eq(order.reference, reference),
            eq(order.userId, params.userId),
            inArray(order.status, ['created', 'pending'])
          )
        ),
      q
        .update(directorySponsorAd)
        .set({ status: 'expired', updatedAt: now })
        .where(
          and(
            eq(directorySponsorAd.id, ad.id),
            eq(directorySponsorAd.userId, params.userId),
            eq(directorySponsorAd.status, 'pending_payment')
          )
        ),
    ]);
  } catch (error) {
    if (error instanceof AtomicGuardError) {
      throw new Error(error.message || 'not_pending');
    }
    throw error;
  }

  // Drizzle/D1 may not return rowsAffected reliably; re-read.
  const [after] = await db()
    .select({ status: directorySponsorAd.status })
    .from(directorySponsorAd)
    .where(eq(directorySponsorAd.id, ad.id))
    .limit(1);
  if (!after || after.status === 'pending_payment') {
    throw new Error('not_pending');
  }
  // Concurrent webhook may have activated the seat while we canceled orders.
  if (after.status === 'active') {
    throw new Error('already_paid');
  }

  // Rare: open order already carried a subscriptionNo (provider race).
  const subscriptionNos: string[] = [];
  for (const o of refreshedOrders) {
    if (o.subscriptionNo && !subscriptionNos.includes(o.subscriptionNo)) {
      subscriptionNos.push(o.subscriptionNo);
    }
  }
  const canceledSubscriptions: string[] = [];
  if (subscriptionNos.length > 0) {
    const { cancelUserSubscription } =
      await import('@/modules/payment/service');
    const { findBySubscriptionNo, SubscriptionStatus } =
      await import('@/modules/subscriptions/service');
    for (const subscriptionNo of subscriptionNos) {
      const sub = await findBySubscriptionNo(subscriptionNo);
      if (!sub || sub.userId !== params.userId) continue;
      if (
        sub.status === SubscriptionStatus.CANCELED ||
        sub.status === SubscriptionStatus.EXPIRED
      ) {
        continue;
      }
      try {
        await cancelUserSubscription({
          userId: params.userId,
          subscriptionNo,
          immediate: true,
        });
        canceledSubscriptions.push(subscriptionNo);
      } catch (err) {
        // Local abandon already committed; do not flip the UI to failure.
        console.error('[cancelPendingSponsorAdPayment] sub cancel failed', {
          subscriptionNo,
          err,
        });
      }
    }
  }

  return {
    id: ad.id,
    status: 'expired' as const,
    canceledOrders: openOrders.length,
    canceledSubscriptions,
  };
}

export async function listMySponsorAds(
  userId: string
): Promise<MySponsorAdItem[]> {
  await releaseStalePendingSponsorAds();
  const rows = await db()
    .select()
    .from(directorySponsorAd)
    .where(eq(directorySponsorAd.userId, userId))
    .orderBy(desc(directorySponsorAd.createdAt));

  const now = Date.now();
  return rows.map((row: any) => {
    let status = row.status as MySponsorAdItem['status'];
    if (
      status === 'active' &&
      row.endsAt &&
      new Date(row.endsAt).getTime() < now
    ) {
      status = 'expired';
    }
    return {
      id: row.id,
      name: row.name,
      tagline: row.tagline || '',
      url: row.url,
      iconUrl: row.iconUrl || '',
      tier: row.tier,
      status,
      startsAt: row.startsAt ? new Date(row.startsAt).toISOString() : '',
      endsAt: row.endsAt ? new Date(row.endsAt).toISOString() : '',
      createdAt: new Date(row.createdAt).toISOString(),
    };
  });
}

export async function countMySubmissions(userId: string) {
  const [row] = await db()
    .select({ count: sql<number>`count(*)`.as('count') })
    .from(directoryTool)
    .where(eq(directoryTool.submittedBy, userId));
  return Number(row?.count || 0);
}

export async function countMySponsorAds(userId: string) {
  const [row] = await db()
    .select({ count: sql<number>`count(*)`.as('count') })
    .from(directorySponsorAd)
    .where(eq(directorySponsorAd.userId, userId));
  return Number(row?.count || 0);
}
