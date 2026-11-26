import { and, asc, desc, eq, inArray, isNull, like, or } from 'drizzle-orm';

import { db } from '@/core/db';
import { directorySponsorAd, directoryTool, order } from '@/config/db/schema';
import {
  getDirectorySponsorProduct,
  getDirectorySubmitProduct,
  getPricingProduct,
} from '@/config/pricing';
import { SPONSOR_PENDING_PAYMENT_TTL_MS } from '@/lib/directory/submit-sponsor-config';

const TOOL_REF_PREFIX = 'directory_tool:';
const AD_REF_PREFIX = 'directory_ad:';

export function directoryToolOrderReference(toolId: string) {
  return `${TOOL_REF_PREFIX}${toolId}`;
}

export function directoryAdOrderReference(adId: string) {
  return `${AD_REF_PREFIX}${adId}`;
}

async function findOpenCheckoutUrl(reference: string, userId: string) {
  const [open] = await db()
    .select({
      checkoutUrl: order.checkoutUrl,
      status: order.status,
    })
    .from(order)
    .where(
      and(
        eq(order.reference, reference),
        eq(order.userId, userId),
        inArray(order.status, ['created', 'pending'])
      )
    )
    .orderBy(desc(order.createdAt))
    .limit(1);
  return open?.checkoutUrl || null;
}

export async function getPayableDirectoryTool(toolId: string, userId: string) {
  const [tool] = await db()
    .select()
    .from(directoryTool)
    .where(
      and(eq(directoryTool.id, toolId), eq(directoryTool.submittedBy, userId))
    )
    .limit(1);
  if (!tool) throw new Error('Submission not found');
  if (tool.status !== 'pending_payment') {
    throw new Error('This submission is not awaiting payment');
  }
  if (tool.plan !== 'premium') {
    throw new Error('Only premium submissions require payment');
  }
  const pkg = getDirectorySubmitProduct('premium');
  if (!pkg) throw new Error('Premium listing product is not configured');
  const existingCheckoutUrl = await findOpenCheckoutUrl(
    directoryToolOrderReference(tool.id),
    userId
  );
  return { tool, pkg, existingCheckoutUrl };
}

export async function getPayableDirectoryAd(adId: string, userId: string) {
  const [ad] = await db()
    .select()
    .from(directorySponsorAd)
    .where(
      and(
        eq(directorySponsorAd.id, adId),
        eq(directorySponsorAd.userId, userId)
      )
    )
    .limit(1);
  if (!ad) throw new Error('Ad not found');

  // Lazy-expire this hold if the checkout window timed out.
  if (
    ad.status === 'pending_payment' &&
    ad.createdAt &&
    Date.now() - new Date(ad.createdAt).getTime() >
      SPONSOR_PENDING_PAYMENT_TTL_MS
  ) {
    const now = new Date();
    await db()
      .update(directorySponsorAd)
      .set({ status: 'expired', updatedAt: now })
      .where(
        and(
          eq(directorySponsorAd.id, ad.id),
          eq(directorySponsorAd.status, 'pending_payment')
        )
      );
    throw new Error('pending_expired');
  }

  if (ad.status !== 'pending_payment') {
    throw new Error('This ad is not awaiting payment');
  }
  const pkg = getDirectorySponsorProduct(ad.tier);
  if (!pkg) throw new Error('Sponsor product is not configured');
  const existingCheckoutUrl = await findOpenCheckoutUrl(
    directoryAdOrderReference(ad.id),
    userId
  );
  return { ad, pkg, existingCheckoutUrl };
}

/**
 * Bundle into payment settlement: premium listing goes live + featured.
 */
export function planDirectoryToolFulfillment(o: {
  orderNo: string;
  reference: string | null;
  productId?: string | null;
}) {
  if (!o.reference?.startsWith(TOOL_REF_PREFIX)) return null;
  const toolId = o.reference.slice(TOOL_REF_PREFIX.length);
  const pkg =
    (o.productId && getPricingProduct(o.productId)) ||
    getDirectorySubmitProduct('premium');
  const days = pkg?.featuredDays || 30;
  const now = new Date();
  const featuredUntil = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  return {
    toolId,
    steps: (q: any) => [
      q
        .update(directoryTool)
        .set({
          status: 'published',
          featured: true,
          featuredUntil,
          publishedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(directoryTool.id, toolId),
            eq(directoryTool.status, 'pending_payment')
          )
        ),
    ],
  };
}

/**
 * Bundle into payment settlement: sponsor ad becomes active for N days.
 * First payment activates pending_payment; renewals extend an already-active ad.
 */
export function planDirectoryAdFulfillment(o: {
  orderNo: string;
  reference: string | null;
  productId?: string | null;
  /** Subscription period end when renewing; otherwise now + featuredDays. */
  periodEnd?: Date | null;
}) {
  if (!o.reference?.startsWith(AD_REF_PREFIX)) return null;
  const adId = o.reference.slice(AD_REF_PREFIX.length);
  const pkg = o.productId ? getPricingProduct(o.productId) : null;
  const days = pkg?.featuredDays || 30;
  const now = new Date();
  const endsAt =
    o.periodEnd && !Number.isNaN(o.periodEnd.getTime())
      ? o.periodEnd
      : new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  return {
    adId,
    steps: (q: any) => [
      // Activate first checkout (or revive a TTL-expired hold that never went live).
      q
        .update(directorySponsorAd)
        .set({
          status: 'active',
          startsAt: now,
          endsAt,
          updatedAt: now,
        })
        .where(
          and(
            eq(directorySponsorAd.id, adId),
            or(
              eq(directorySponsorAd.status, 'pending_payment'),
              and(
                eq(directorySponsorAd.status, 'expired'),
                isNull(directorySponsorAd.startsAt)
              )
            )
          )
        ),
      // Monthly renewal: extend an already-active seat only.
      // Do not revive force-expired / refunded / canceled rows — those stay
      // offline until a new booking. First checkout still activates
      // pending_payment (or never-started expired holds) above.
      q
        .update(directorySponsorAd)
        .set({
          status: 'active',
          endsAt,
          updatedAt: now,
        })
        .where(
          and(
            eq(directorySponsorAd.id, adId),
            eq(directorySponsorAd.status, 'active')
          )
        ),
    ],
  };
}

/** On refund: take listing down / expire the ad. */
export function planDirectoryToolRefund(o: { reference: string | null }) {
  if (!o.reference?.startsWith(TOOL_REF_PREFIX)) return null;
  const toolId = o.reference.slice(TOOL_REF_PREFIX.length);
  const now = new Date();
  return (q: any) => [
    q
      .update(directoryTool)
      .set({
        status: 'rejected',
        featured: false,
        featuredUntil: null,
        updatedAt: now,
      })
      .where(eq(directoryTool.id, toolId)),
  ];
}

export function planDirectoryAdRefund(o: { reference: string | null }) {
  if (!o.reference?.startsWith(AD_REF_PREFIX)) return null;
  const adId = o.reference.slice(AD_REF_PREFIX.length);
  const now = new Date();
  return (q: any) => [
    q
      .update(directorySponsorAd)
      .set({
        status: 'expired',
        endsAt: now,
        updatedAt: now,
      })
      .where(eq(directorySponsorAd.id, adId)),
  ];
}

/** Find the sponsor ad tied to a subscription (from the first checkout order). */
export async function findDirectoryAdReferenceBySubscription(
  subscriptionNo: string
) {
  const [row] = await db()
    .select({ reference: order.reference })
    .from(order)
    .where(
      and(
        eq(order.subscriptionNo, subscriptionNo),
        like(order.reference, `${AD_REF_PREFIX}%`)
      )
    )
    .orderBy(asc(order.createdAt))
    .limit(1);
  return row?.reference || null;
}

/**
 * Take a sponsor seat offline when its subscription is fully canceled.
 * No-op for non-sponsor subscriptions. Idempotent.
 */
export async function expireDirectoryAdForSubscription(subscriptionNo: string) {
  const reference =
    await findDirectoryAdReferenceBySubscription(subscriptionNo);
  if (!reference) return;
  const plan = planDirectoryAdRefund({ reference });
  if (!plan) return;
  const q = db();
  for (const step of plan(q)) {
    if (step) await step;
  }
}

/** Map subscriptionNo → sponsor ad name (for billing multi-seat labels). */
export async function mapSubscriptionAdNames(
  subscriptionNos: string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const nos = [...new Set(subscriptionNos.filter(Boolean))];
  if (nos.length === 0) return out;

  const orderRows = await db()
    .select({
      subscriptionNo: order.subscriptionNo,
      reference: order.reference,
    })
    .from(order)
    .where(
      and(
        inArray(order.subscriptionNo, nos),
        like(order.reference, `${AD_REF_PREFIX}%`)
      )
    )
    .orderBy(asc(order.createdAt));

  const adIdBySub = new Map<string, string>();
  for (const row of orderRows) {
    if (!row.subscriptionNo || !row.reference) continue;
    if (adIdBySub.has(row.subscriptionNo)) continue;
    if (!row.reference.startsWith(AD_REF_PREFIX)) continue;
    adIdBySub.set(
      row.subscriptionNo,
      row.reference.slice(AD_REF_PREFIX.length)
    );
  }
  if (adIdBySub.size === 0) return out;

  const adIds = [...new Set(adIdBySub.values())];
  const ads = await db()
    .select({
      id: directorySponsorAd.id,
      name: directorySponsorAd.name,
    })
    .from(directorySponsorAd)
    .where(inArray(directorySponsorAd.id, adIds));
  const nameById = new Map<string, string>(
    ads.map((a: { id: string; name: string }) => [a.id, a.name])
  );

  for (const [subscriptionNo, adId] of adIdBySub) {
    const name = nameById.get(adId);
    if (name) out.set(subscriptionNo, name);
  }
  return out;
}

/**
 * Extend / re-activate the ad for a subscription renewal period.
 * Idempotent: safe to retry; sets endsAt to the billing period end.
 * Prefer bundling via planDirectoryAdFulfillment inside the renewal atomic
 * write; this standalone path heals prior partial renewals.
 */
export async function renewDirectoryAdForSubscription(params: {
  subscriptionNo: string;
  productId?: string | null;
  periodEnd: Date;
}) {
  const reference = await findDirectoryAdReferenceBySubscription(
    params.subscriptionNo
  );
  if (!reference?.startsWith(AD_REF_PREFIX)) return;
  const plan = planDirectoryAdFulfillment({
    orderNo: '',
    reference,
    productId: params.productId,
    periodEnd: params.periodEnd,
  });
  if (!plan) return;
  const q = db();
  for (const step of plan.steps(q)) {
    if (step) await step;
  }
}
