import {
  aliasedTable as alias,
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  exists,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  ne,
  not,
  or,
  sql,
  sum,
} from 'drizzle-orm';

import { db } from '@/core/db';
import { atomic, AtomicGuardError, guard } from '@/core/db/atomic';
import { getUsdRates, type UsdRates } from '@/core/exchange/usd-rates';
import {
  AFFILIATE_INVITE_CODE_PATTERN,
  AFFILIATE_MAX_COMMISSION_PERCENT,
  getAffiliateCommissionPercent,
  getAffiliateRewardRule,
  isReservedInviteCode,
  minWithdrawFor,
  parseReservedInviteWords,
  percentOf,
  rewardAvailableAt,
  rewardPaymentLimit,
  type AffiliateRewardRule,
} from '@/config/affiliates';
import {
  affiliateInvite,
  affiliateInviteCode,
  affiliateReward,
  affiliateUser,
  affiliateWithdraw,
  order,
  user,
  type AffiliateInviteCode,
  type AffiliateUser,
  type NewAffiliateInviteCode,
  type NewAffiliateReward,
  type NewAffiliateWithdraw,
} from '@/config/db/schema';
import { isUserFeatureOn } from '@/config/user-features';
import { getAllConfigs } from '@/modules/config/service';
import { getNonceStr, getSnowId, getUuid } from '@/lib/hash';
import { keywordMatch } from '@/lib/sql-search';

export const AFFILIATE_USER_STATUSES = [
  'pending',
  'active',
  'rejected',
] as const;
export const AFFILIATE_WITHDRAW_STATUSES = [
  'pending',
  'success',
  'rejected',
] as const;

type Result = { ok: boolean; error?: string };

// ─── Affiliate user ───────────────────────────────────────────────────────────

export function isAffiliateApproved(
  row?: { status?: string | null } | null
): boolean {
  return row?.status === 'active';
}

export async function findAffiliateUserByUserId(userId: string) {
  const [row] = await db()
    .select()
    .from(affiliateUser)
    .where(eq(affiliateUser.userId, userId))
    .limit(1);
  return row;
}

/** Submit (or re-submit after rejection) an affiliate application. */
export async function applyAffiliate({
  userId,
  userEmail,
  reason = '',
  autoApprove = false,
}: {
  userId: string;
  userEmail: string;
  reason?: string;
  /** Skip review (Settings → Users → Affiliates → auto approve). */
  autoApprove?: boolean;
}): Promise<{ ok: boolean; status: string }> {
  const applyReason = reason.trim().slice(0, 1000);
  const status = autoApprove ? 'active' : 'pending';
  const existing = await findAffiliateUserByUserId(userId);
  if (existing) {
    if (isAffiliateApproved(existing)) return { ok: true, status: 'active' };
    if (existing.status === 'pending' && !autoApprove)
      return { ok: true, status: 'pending' };
    await db()
      .update(affiliateUser)
      .set({ status, applyReason })
      .where(eq(affiliateUser.id, existing.id));
  } else {
    try {
      await db().insert(affiliateUser).values({
        id: getUuid(),
        userId,
        userEmail,
        status,
        commissionPercent: 0,
        applyReason,
      });
    } catch (error) {
      // A concurrent request created it first (unique user_id).
      if (!(await findAffiliateUserByUserId(userId))) throw error;
    }
  }
  if (status === 'active') await ensureDefaultInviteCode(userId);
  return { ok: true, status };
}

async function getApprovedAffiliate(userId: string) {
  const owner = await findAffiliateUserByUserId(userId);
  if (!owner) return { error: 'not_applied' as const };
  if (!isAffiliateApproved(owner)) return { error: 'not_approved' as const };
  return { owner };
}

// ─── Invite codes (referral links) ────────────────────────────────────────────
//
// An affiliate can publish several invite codes (one per channel); every
// one records sign-ups as theirs.

async function validateInviteCodeInput(input: string): Promise<{
  code?: string;
  error?: string;
}> {
  const code = input.trim();
  if (!AFFILIATE_INVITE_CODE_PATTERN.test(code))
    return { error: 'invalid_code' };
  if (await hasReservedWord(code)) return { error: 'reserved_code' };
  return { code };
}

/** Whether a code an affiliate picks contains an admin-reserved word. */
async function hasReservedWord(code: string): Promise<boolean> {
  const reserved = parseReservedInviteWords(
    (await getAllConfigs()).affiliate_reserved_codes
  );
  return isReservedInviteCode(code, reserved);
}

async function findInviteCodeRow(inviteCode: string) {
  const code = inviteCode.trim();
  if (!code) return undefined;
  const [row] = await db()
    .select()
    .from(affiliateInviteCode)
    .where(eq(affiliateInviteCode.code, code))
    .limit(1);
  return row;
}

/** The affiliate owning an invite code. */
export async function findAffiliateUserByInviteCode(inviteCode: string) {
  const row = await findInviteCodeRow(inviteCode);
  return row ? findAffiliateUserByUserId(row.userId) : undefined;
}

/**
 * Give an approved affiliate a first invite link, so their dashboard always
 * has one to share. No-op when they already have any.
 */
export async function ensureDefaultInviteCode(userId: string): Promise<void> {
  const [existing] = await db()
    .select({ id: affiliateInviteCode.id })
    .from(affiliateInviteCode)
    .where(eq(affiliateInviteCode.userId, userId))
    .limit(1);
  if (existing) return;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await db()
        .insert(affiliateInviteCode)
        .values({
          id: getUuid(),
          userId,
          code: getNonceStr(8).toLowerCase(),
          isDefault: true,
        });
      return;
    } catch {
      // Code collision (or a concurrent first insert): check and retry.
      const [again] = await db()
        .select({ id: affiliateInviteCode.id })
        .from(affiliateInviteCode)
        .where(eq(affiliateInviteCode.userId, userId))
        .limit(1);
      if (again) return;
    }
  }
}

export async function listInviteCodes({
  userId,
}: {
  userId: string;
}): Promise<AffiliateInviteCode[]> {
  return (await db()
    .select()
    .from(affiliateInviteCode)
    .where(eq(affiliateInviteCode.userId, userId))
    .orderBy(
      desc(affiliateInviteCode.isDefault),
      asc(affiliateInviteCode.createdAt)
    )) as AffiliateInviteCode[];
}

/** Pick which code is shown as the affiliate's main invite link. */
export async function setDefaultInviteCode({
  userId,
  id,
}: {
  userId: string;
  id: string;
}): Promise<Result> {
  const owner = await getApprovedAffiliate(userId);
  if ('error' in owner) return { ok: false, error: owner.error };

  const [current] = await db()
    .select({ id: affiliateInviteCode.id })
    .from(affiliateInviteCode)
    .where(
      and(
        eq(affiliateInviteCode.id, id),
        eq(affiliateInviteCode.userId, userId)
      )
    )
    .limit(1);
  if (!current) return { ok: false, error: 'not_found' };

  await atomic((q) => [
    q
      .update(affiliateInviteCode)
      .set({ isDefault: false })
      .where(eq(affiliateInviteCode.userId, userId)),
    q
      .update(affiliateInviteCode)
      .set({ isDefault: true })
      .where(eq(affiliateInviteCode.id, id)),
  ]);
  return { ok: true };
}

export async function createInviteCode({
  userId,
  inviteCode,
}: {
  userId: string;
  inviteCode: string;
}): Promise<Result> {
  const owner = await getApprovedAffiliate(userId);
  if ('error' in owner) return { ok: false, error: owner.error };

  const validated = await validateInviteCodeInput(inviteCode);
  if (!validated.code) return { ok: false, error: validated.error };

  if (await findInviteCodeRow(validated.code))
    return { ok: false, error: 'code_taken' };

  const [count_] = await db()
    .select({ total: count() })
    .from(affiliateInviteCode)
    .where(eq(affiliateInviteCode.userId, userId));
  if (Number(count_?.total ?? 0) >= 50) return { ok: false, error: 'too_many' };

  try {
    await db()
      .insert(affiliateInviteCode)
      .values({
        id: getUuid(),
        userId,
        code: validated.code,
        // The affiliate's first code becomes their main link.
        isDefault: Number(count_?.total ?? 0) === 0,
      });
  } catch (error) {
    if (await findInviteCodeRow(validated.code))
      return { ok: false, error: 'code_taken' };
    throw error;
  }
  return { ok: true };
}

export async function updateInviteCode({
  userId,
  id,
  inviteCode,
}: {
  userId: string;
  id: string;
  inviteCode?: string;
}): Promise<Result> {
  const owner = await getApprovedAffiliate(userId);
  if ('error' in owner) return { ok: false, error: owner.error };

  const [current] = await db()
    .select()
    .from(affiliateInviteCode)
    .where(
      and(
        eq(affiliateInviteCode.id, id),
        eq(affiliateInviteCode.userId, userId)
      )
    )
    .limit(1);
  if (!current) return { ok: false, error: 'not_found' };

  const patch: Partial<NewAffiliateInviteCode> = {};
  if (inviteCode !== undefined && inviteCode.trim() !== current.code) {
    const validated = await validateInviteCodeInput(inviteCode);
    if (!validated.code) return { ok: false, error: validated.error };
    if (await findInviteCodeRow(validated.code))
      return { ok: false, error: 'code_taken' };
    patch.code = validated.code;
  }
  if (!Object.keys(patch).length) return { ok: true };

  try {
    await db()
      .update(affiliateInviteCode)
      .set(patch)
      .where(eq(affiliateInviteCode.id, id));
  } catch (error) {
    if (patch.code && (await findInviteCodeRow(patch.code)))
      return { ok: false, error: 'code_taken' };
    throw error;
  }
  return { ok: true };
}

export async function deleteInviteCode({
  userId,
  id,
}: {
  userId: string;
  id: string;
}): Promise<Result> {
  const owner = await getApprovedAffiliate(userId);
  if ('error' in owner) return { ok: false, error: owner.error };

  const [current] = await db()
    .select()
    .from(affiliateInviteCode)
    .where(
      and(
        eq(affiliateInviteCode.id, id),
        eq(affiliateInviteCode.userId, userId)
      )
    )
    .limit(1);
  if (!current) return { ok: false, error: 'not_found' };

  // Deleting the main link promotes the next oldest, so the dashboard never
  // ends up without one while codes remain. Referrals already recorded keep
  // working: affiliate_invite stores the inviter, not the code row.
  const [next] = current.isDefault
    ? await db()
        .select({ id: affiliateInviteCode.id })
        .from(affiliateInviteCode)
        .where(
          and(
            eq(affiliateInviteCode.userId, userId),
            ne(affiliateInviteCode.id, id)
          )
        )
        .orderBy(asc(affiliateInviteCode.createdAt))
        .limit(1)
    : [];
  await atomic((q) => [
    q.delete(affiliateInviteCode).where(eq(affiliateInviteCode.id, id)),
    next &&
      q
        .update(affiliateInviteCode)
        .set({ isDefault: true })
        .where(eq(affiliateInviteCode.id, next.id)),
  ]);
  return { ok: true };
}

// ─── Reward rule ─────────────────────────────────────────────────────────────

/** The admin's reward settings (Settings → Users → Affiliates). */
export async function getRewardRule(): Promise<AffiliateRewardRule> {
  return getAffiliateRewardRule(await getAllConfigs());
}

// ─── Invites ──────────────────────────────────────────────────────────────────

/**
 * Record the inviter→invitee relationship when a new user signs up through
 * an invite link. No-op on self-invite, unknown or unapproved codes, or an
 * existing relationship. Never throws (called from the sign-up hook).
 */
export async function handleInviteNewUser({
  newUserId,
  inviteCode,
}: {
  newUserId: string;
  inviteCode: string;
}): Promise<void> {
  try {
    if (!newUserId || !AFFILIATE_INVITE_CODE_PATTERN.test(inviteCode)) return;
    const inviter = await findAffiliateUserByInviteCode(inviteCode);
    if (!inviter?.userId || !isAffiliateApproved(inviter)) return;
    if (inviter.userId === newUserId) return;
    await db().insert(affiliateInvite).values({
      id: getUuid(),
      userId: inviter.userId,
      inviteUserId: newUserId,
      inviteCode,
      status: 'active',
    });
  } catch (error) {
    // Already invited (unique invite_user_id) or a transient failure: sign-up
    // must go on either way.
    console.warn('[affiliates] record invite failed', error);
  }
}

/** First paid order time per user (the invite's conversion). */
function firstPaidOrders() {
  return db()
    .select({
      userId: order.userId,
      firstPaidAt: sql`min(${order.createdAt})`.as('first_paid_at'),
    })
    .from(order)
    .where(eq(order.status, 'paid'))
    .groupBy(order.userId)
    .as('first_paid');
}

export async function getInvites({
  userId,
  search,
  page = 1,
  limit = 10,
}: {
  userId: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const firstPaid = firstPaidOrders();
  const rows = await db()
    .select({
      invite: affiliateInvite,
      invitedUser: { name: user.name, image: user.image },
      paidOrder: {
        id: order.id,
        paymentAmount: order.paymentAmount,
        paymentCurrency: order.paymentCurrency,
        amount: order.amount,
        currency: order.currency,
      },
    })
    .from(affiliateInvite)
    .leftJoin(user, eq(user.id, affiliateInvite.inviteUserId))
    .leftJoin(firstPaid, eq(firstPaid.userId, affiliateInvite.inviteUserId))
    .leftJoin(
      order,
      and(
        eq(order.userId, affiliateInvite.inviteUserId),
        eq(order.status, 'paid'),
        eq(order.createdAt, firstPaid.firstPaidAt)
      )
    )
    .where(
      and(
        eq(affiliateInvite.userId, userId),
        keywordMatch(search, { contains: [affiliateInvite.inviteCode] })
      )
    )
    .orderBy(desc(affiliateInvite.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  return rows.map((r: any) => ({
    id: r.invite.id,
    inviteCode: r.invite.inviteCode,
    status: r.invite.status,
    createdAt: r.invite.createdAt,
    invitedUserName: r.invitedUser?.name ?? null,
    invitedUserAvatar: r.invitedUser?.image ?? null,
    paid: !!r.paidOrder?.id,
    firstPaidAmount: r.paidOrder?.paymentAmount ?? r.paidOrder?.amount ?? null,
    firstPaidCurrency:
      r.paidOrder?.paymentCurrency ?? r.paidOrder?.currency ?? null,
  }));
}

export async function getInvitesCount({
  userId,
  search,
}: {
  userId: string;
  search?: string;
}): Promise<number> {
  const [row] = await db()
    .select({ count: count() })
    .from(affiliateInvite)
    .where(
      and(
        eq(affiliateInvite.userId, userId),
        keywordMatch(search, { contains: [affiliateInvite.inviteCode] })
      )
    );
  return Number(row?.count || 0);
}

/** Mask a nickname for public display: "gstar wd" → "g***d", "熠辉" → "熠***". */
function maskName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '***';
  if (trimmed.length <= 2) return `${trimmed[0]}***`;
  return `${trimmed[0]}***${trimmed[trimmed.length - 1]}`;
}

/** Public top-inviter leaderboard with masked names (the /affiliates page). */
export async function getInviteLeaderboard(limit = 10) {
  const rows = await db()
    .select({
      userId: affiliateInvite.userId,
      invites: count(),
      name: user.name,
      avatar: user.image,
    })
    .from(affiliateInvite)
    .innerJoin(user, eq(user.id, affiliateInvite.userId))
    .groupBy(affiliateInvite.userId, user.name, user.image)
    .orderBy(desc(count()))
    .limit(limit);

  return rows.map((r: any) => ({
    invites: Number(r.invites),
    name: maskName(r.name ?? ''),
    avatar: r.avatar ?? null,
  }));
}

// ─── Rewards ──────────────────────────────────────────────────────────────────

export async function getRewards({
  userId,
  status,
  search,
  page = 1,
  limit = 10,
}: {
  userId: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const payer = alias(user, 'payer');
  const rows = await db()
    .select({
      reward: affiliateReward,
      order: {
        paymentAmount: order.paymentAmount,
        paymentCurrency: order.paymentCurrency,
        amount: order.amount,
        currency: order.currency,
        productName: order.productName,
      },
      payer: { name: payer.name, image: payer.image },
    })
    .from(affiliateReward)
    .leftJoin(order, eq(order.orderNo, affiliateReward.orderNo))
    .leftJoin(payer, eq(payer.id, order.userId))
    .where(
      and(
        eq(affiliateReward.userId, userId),
        status ? eq(affiliateReward.status, status) : undefined,
        keywordMatch(search, {
          contains: [affiliateReward.transactionNo, affiliateReward.orderNo],
        })
      )
    )
    .orderBy(desc(affiliateReward.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  return rows.map((r: any) => ({
    ...r.reward,
    paidAmount: r.order?.paymentAmount ?? r.order?.amount ?? null,
    paidCurrency: r.order?.paymentCurrency ?? r.order?.currency ?? null,
    productName: r.order?.productName ?? null,
    paidUserName: r.payer?.name ?? null,
    paidUserAvatar: r.payer?.image ?? null,
  }));
}

export async function getRewardsCount({
  userId,
  status,
  search,
}: {
  userId: string;
  status?: string;
  search?: string;
}): Promise<number> {
  const [row] = await db()
    .select({ count: count() })
    .from(affiliateReward)
    .where(
      and(
        eq(affiliateReward.userId, userId),
        status ? eq(affiliateReward.status, status) : undefined,
        keywordMatch(search, {
          contains: [affiliateReward.transactionNo, affiliateReward.orderNo],
        })
      )
    );
  return Number(row?.count || 0);
}

type CurrencyAmount = { currency: string; amount: number };

export interface AffiliateRewardDetail {
  inviteTotal: number;
  /** Number of active rewards. */
  rewardTotal: number;
  /** Active rewards per currency. */
  rewardAmounts: CurrencyAmount[];
  /** Withdrawn or being withdrawn (not rejected), per currency. */
  withdrawAmounts: CurrencyAmount[];
  /** Available to withdraw, per currency. */
  rewardBalances: CurrencyAmount[];
  /** Earned but still in the hold period, per currency. */
  pendingBalances: CurrencyAmount[];
  /** When the earliest held reward becomes withdrawable (ISO), if any. */
  nextAvailableAt: string | null;
  /** Smallest withdrawable balance per currency in rewardBalances. */
  minWithdraw: CurrencyAmount[];
  /** A request is waiting for an admin. */
  hasPendingWithdraw: boolean;
}

/** Sum rows per uppercased currency (legacy rows may be lowercase). */
function aggregateByCurrency(
  rows: Array<{ currency: string | null; amount: unknown }>
): CurrencyAmount[] {
  const totals = new Map<string, number>();
  for (const r of rows || []) {
    const currency = (r.currency || '').toUpperCase();
    const amount = Number(r.amount ?? 0);
    if (!currency || amount <= 0) continue;
    totals.set(currency, (totals.get(currency) || 0) + amount);
  }
  return [...totals].map(([currency, amount]) => ({ currency, amount }));
}

/** A reward past its hold period (null available_at = no hold). */
function rewardAvailable(now: Date) {
  return or(
    isNull(affiliateReward.availableAt),
    lte(affiliateReward.availableAt, now)
  )!;
}

export async function getRewardDetail({
  userId,
  rule,
}: {
  userId: string;
  rule?: AffiliateRewardRule;
}): Promise<AffiliateRewardDetail> {
  const now = new Date();
  const [
    inviteRows,
    rewardRows,
    withdrawRows,
    rewardTotalRows,
    pendingRows,
    heldRows,
    r,
  ] = await Promise.all([
    db()
      .select({ count: count() })
      .from(affiliateInvite)
      .where(eq(affiliateInvite.userId, userId)),
    db()
      .select({
        currency: affiliateReward.rewardCurrency,
        amount: sum(affiliateReward.rewardAmount),
      })
      .from(affiliateReward)
      .where(
        and(
          eq(affiliateReward.userId, userId),
          eq(affiliateReward.status, 'active'),
          rewardAvailable(now)
        )
      )
      .groupBy(affiliateReward.rewardCurrency),
    db()
      .select({
        currency: affiliateWithdraw.currency,
        amount: sum(affiliateWithdraw.amount),
      })
      .from(affiliateWithdraw)
      .where(
        and(
          eq(affiliateWithdraw.userId, userId),
          ne(affiliateWithdraw.status, 'rejected')
        )
      )
      .groupBy(affiliateWithdraw.currency),
    db()
      .select({
        total: count(),
      })
      .from(affiliateReward)
      .where(
        and(
          eq(affiliateReward.userId, userId),
          eq(affiliateReward.status, 'active')
        )
      ),
    db()
      .select({ id: affiliateWithdraw.id })
      .from(affiliateWithdraw)
      .where(
        and(
          eq(affiliateWithdraw.userId, userId),
          eq(affiliateWithdraw.status, 'pending')
        )
      )
      .limit(1),
    db()
      .select({
        currency: affiliateReward.rewardCurrency,
        amount: affiliateReward.rewardAmount,
        availableAt: affiliateReward.availableAt,
      })
      .from(affiliateReward)
      .where(
        and(
          eq(affiliateReward.userId, userId),
          eq(affiliateReward.status, 'active'),
          not(rewardAvailable(now))
        )
      ),
    rule ?? getRewardRule(),
  ]);

  const availableAmounts = aggregateByCurrency(rewardRows as any);
  const pendingBalances = aggregateByCurrency(heldRows as any);
  const rewardAmounts = aggregateByCurrency([
    ...availableAmounts,
    ...pendingBalances,
  ]);
  const withdrawAmounts = aggregateByCurrency(withdrawRows as any);
  const rewardBalances: CurrencyAmount[] = [];
  for (const currency of new Set([
    ...availableAmounts.map((a) => a.currency),
    ...withdrawAmounts.map((w) => w.currency),
  ])) {
    const reward =
      availableAmounts.find((a) => a.currency === currency)?.amount || 0;
    const withdrawn =
      withdrawAmounts.find((w) => w.currency === currency)?.amount || 0;
    // A refund after a payout can push this below zero; show zero.
    const balance = Math.max(reward - withdrawn, 0);
    if (balance > 0) rewardBalances.push({ currency, amount: balance });
  }

  return {
    inviteTotal: Number(inviteRows?.[0]?.count ?? 0),
    rewardTotal: Number(rewardTotalRows?.[0]?.total ?? 0),
    rewardAmounts,
    withdrawAmounts,
    rewardBalances,
    pendingBalances,
    nextAvailableAt:
      (heldRows as Array<{ availableAt: Date | null }>)
        .map((h) => h.availableAt)
        .filter((d): d is Date => d instanceof Date)
        .sort((x, y) => x.getTime() - y.getTime())[0]
        ?.toISOString() ?? null,
    // Every currency the affiliate earns in, so the page can show the bar.
    minWithdraw: [
      ...new Set(
        [...rewardBalances, ...pendingBalances].map((b) => b.currency)
      ),
    ].map((currency) => ({ currency, amount: minWithdrawFor(r, currency) })),
    hasPendingWithdraw: pendingRows.length > 0,
  };
}

// ─── Rewards on paid orders (called by payment/service.ts) ───────────────────

type PaidOrderLike = {
  userId: string;
  orderNo: string;
  amount: number;
  currency: string;
  /** What the buyer actually paid, as reported by the payment provider. */
  paymentAmount?: number | null;
};

/** What the buyer actually paid (the order amount if none was reported). */
function chargedAmount(o: PaidOrderLike): number {
  return Math.max((o.paymentAmount ?? o.amount) || 0, 0);
}

/** Steps for the order-paid atomic write (the reward row). */
export type PlannedAffiliateReward = (q: any) => any[];

/** The approved affiliate who invited the buyer of a paid order, if any. */
async function attributeOrder(
  paidOrder: PaidOrderLike
): Promise<AffiliateUser | null> {
  const [invite] = await db()
    .select({ userId: affiliateInvite.userId })
    .from(affiliateInvite)
    .where(
      and(
        eq(affiliateInvite.inviteUserId, paidOrder.userId),
        eq(affiliateInvite.status, 'active')
      )
    )
    .limit(1);
  if (!invite) return null;
  const inviter = await findAffiliateUserByUserId(invite.userId);
  return isAffiliateApproved(inviter) && inviter!.userId !== paidOrder.userId
    ? inviter!
    : null;
}

/**
 * How many charged payments the buyer made before this order (refunded ones
 * too). A $0 order (a free trial's start, a 100% coupon) charged nothing, so
 * it doesn't count: the first real charge, often a renewal, is the first
 * payment.
 */
async function priorPaymentCount(userId: string, orderNo?: string) {
  const [prior] = await db()
    .select({ total: count() })
    .from(order)
    .where(
      and(
        eq(order.userId, userId),
        orderNo ? ne(order.orderNo, orderNo) : undefined,
        inArray(order.status, ['paid', 'refunding', 'refunded']),
        sql`coalesce(${order.paymentAmount}, ${order.amount}) > 0`
      )
    );
  return Number(prior?.total ?? 0);
}

/**
 * The affiliate reward for a paid order, or null. Reads only; never throws
 * (affiliate accounting must not block a payment).
 *
 * Which payments earn is the rule's scope: the buyer's first charged
 * payment, their first N, or all of them, whether checkouts or subscription
 * renewals (a free trial's first charge is a renewal). Refunded payments
 * still count toward N, so refund-and-rebuy can't reset it. The commission
 * is a percent of what was actually charged (see `chargedAmount`).
 */
export async function planAffiliateReward(
  paidOrder: PaidOrderLike,
  rule?: AffiliateRewardRule
): Promise<PlannedAffiliateReward | null> {
  try {
    const { userId, orderNo } = paidOrder;
    const charged = chargedAmount(paidOrder);
    if (!userId || !orderNo || charged <= 0) return null;

    // The program's master switch: off means no new rewards (refunds still
    // revoke the ones already granted).
    const configs = await getAllConfigs();
    if (!isUserFeatureOn(configs, 'affiliates_enabled')) return null;

    const owner = await attributeOrder(paidOrder);
    if (!owner) return null;

    const r = rule ?? getAffiliateRewardRule(configs);
    const limit = rewardPaymentLimit(r);
    if (limit !== null && (await priorPaymentCount(userId, orderNo)) >= limit)
      return null;

    const rewardPercent = getAffiliateCommissionPercent(owner, r);
    const rewardAmount = percentOf(charged, rewardPercent);
    if (rewardAmount <= 0) return null;

    const reward: NewAffiliateReward = {
      id: getUuid(),
      // One reward per order, enforced by the unique key.
      transactionNo: `aff_${orderNo}`,
      userId: owner.userId,
      orderNo,
      rewardType: 'cash',
      rewardPercent,
      rewardAmount,
      rewardCurrency: (paidOrder.currency || 'usd').toUpperCase(),
      rewardScene: r.scope === 'first' ? 'first_payment' : 'payment',
      status: 'active',
      // Waits out the refund window before it can be withdrawn.
      availableAt: rewardAvailableAt(r),
    };
    return (q: any) => [q.insert(affiliateReward).values(reward)];
  } catch (error) {
    console.error('[affiliates] plan reward failed:', error);
    return null;
  }
}

/** Steps that revoke an order's reward (a refund). */
export function planAffiliateRewardRevoke(orderNo: string) {
  return (q: any) => [
    q
      .update(affiliateReward)
      .set({ status: 'revoked' })
      .where(
        and(
          eq(affiliateReward.orderNo, orderNo),
          eq(affiliateReward.status, 'active')
        )
      ),
  ];
}

// ─── Withdraws ────────────────────────────────────────────────────────────────

export async function getWithdraws({
  userId,
  status,
  search,
  page = 1,
  limit = 10,
}: {
  userId: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  return db()
    .select()
    .from(affiliateWithdraw)
    .where(
      and(
        eq(affiliateWithdraw.userId, userId),
        status ? eq(affiliateWithdraw.status, status) : undefined,
        keywordMatch(search, { contains: [affiliateWithdraw.transactionNo] })
      )
    )
    .orderBy(desc(affiliateWithdraw.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);
}

export async function getWithdrawsCount({
  userId,
  status,
  search,
}: {
  userId: string;
  status?: string;
  search?: string;
}): Promise<number> {
  const [row] = await db()
    .select({ count: count() })
    .from(affiliateWithdraw)
    .where(
      and(
        eq(affiliateWithdraw.userId, userId),
        status ? eq(affiliateWithdraw.status, status) : undefined,
        keywordMatch(search, { contains: [affiliateWithdraw.transactionNo] })
      )
    );
  return Number(row?.count || 0);
}

/**
 * Withdrawable rewards (active, past their hold) − non-rejected withdrawals
 * of a user in one currency.
 */
function balanceSql(userId: string, currency: string, now: Date) {
  return sql`(select coalesce(sum(${affiliateReward.rewardAmount}), 0) from ${affiliateReward} where ${affiliateReward.userId} = ${userId} and ${affiliateReward.status} = 'active' and ${rewardAvailable(now)} and upper(${affiliateReward.rewardCurrency}) = ${currency}) - (select coalesce(sum(${affiliateWithdraw.amount}), 0) from ${affiliateWithdraw} where ${affiliateWithdraw.userId} = ${userId} and ${affiliateWithdraw.status} <> 'rejected' and upper(${affiliateWithdraw.currency}) = ${currency})`;
}

/**
 * Request a payout of every balance at or above its currency's minimum. One
 * pending request at a time; an admin pays it by hand and marks it done.
 */
export async function createWithdraw({
  userId,
  description,
}: {
  userId: string;
  description: string;
}): Promise<Result> {
  const owner = await findAffiliateUserByUserId(userId);
  if (!owner) return { ok: false, error: 'not_applied' };

  const rule = await getRewardRule();
  const now = new Date();
  const detail = await getRewardDetail({ userId, rule });
  if (detail.hasPendingWithdraw) return { ok: false, error: 'pending_exists' };
  const eligible = detail.rewardBalances.filter(
    (b) => b.amount >= Math.max(minWithdrawFor(rule, b.currency), 1)
  );
  if (eligible.length === 0) return { ok: false, error: 'no_balance' };

  const values: NewAffiliateWithdraw[] = eligible.map((b) => ({
    id: getUuid(),
    transactionNo: getSnowId(),
    userId,
    amount: b.amount,
    currency: b.currency,
    status: 'pending',
    description: description.slice(0, 1000),
    remark: '',
  }));

  try {
    await atomic((q) => [
      // Claim: no other pending request. On Postgres/MySQL this also locks
      // the affiliate row, so concurrent requests for one user run in turn.
      guard({
        table: affiliateUser,
        column: 'userId',
        where: eq(affiliateUser.userId, userId),
        require: sql`not exists (select 1 from ${affiliateWithdraw} where ${affiliateWithdraw.userId} = ${userId} and ${affiliateWithdraw.status} = 'pending')`,
        message: 'pending_exists',
      }),
      ...values.map((v) => q.insert(affiliateWithdraw).values(v)),
      // Postcondition: never more than the balance (a refund may have
      // revoked a reward since the read above).
      ...values.map((v) =>
        guard({
          table: affiliateUser,
          column: 'userId',
          where: eq(affiliateUser.userId, userId),
          require: sql`${balanceSql(userId, v.currency!, now)} >= 0`,
          message: 'no_balance',
        })
      ),
    ]);
  } catch (error) {
    if (error instanceof AtomicGuardError)
      return { ok: false, error: error.message };
    throw error;
  }
  return { ok: true };
}

// ════════════════════════════════════════════════════════════════════════════
// Admin
// ════════════════════════════════════════════════════════════════════════════

export async function listAffiliateUsersAdmin({
  search,
  status,
  page = 1,
  limit = 20,
}: {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  const keyword = keywordMatch(search, {
    contains: [affiliateUser.userEmail, user.name, user.email],
    exact: [affiliateUser.userId],
  });
  const codeMatch = (column: any) =>
    keywordMatch(search, { contains: [column] });
  const where = and(
    keyword
      ? or(
          keyword,
          // Invite links live in their own table.
          exists(
            db()
              .select({ one: sql`1` })
              .from(affiliateInviteCode)
              .where(
                and(
                  eq(affiliateInviteCode.userId, affiliateUser.userId),
                  codeMatch(affiliateInviteCode.code)
                )
              )
          )
        )
      : undefined,
    status ? eq(affiliateUser.status, status) : undefined
  );

  const [rows, [c]] = await Promise.all([
    db()
      .select({
        a: affiliateUser,
        u: { name: user.name, email: user.email, image: user.image },
      })
      .from(affiliateUser)
      .leftJoin(user, eq(user.id, affiliateUser.userId))
      .where(where)
      .orderBy(desc(affiliateUser.createdAt))
      .limit(limit)
      .offset((page - 1) * limit),
    db()
      .select({ count: count() })
      .from(affiliateUser)
      .leftJoin(user, eq(user.id, affiliateUser.userId))
      .where(where),
  ]);

  const rule = await getRewardRule();
  const userIds = rows.map((r: any) => r.a.userId);
  const inviteCodesByUser = await groupByUser<AffiliateInviteCode>(
    affiliateInviteCode,
    userIds,
    [desc(affiliateInviteCode.isDefault), asc(affiliateInviteCode.createdAt)]
  );

  const items = rows.map((r: any) => {
    const inviteCodes = inviteCodesByUser.get(r.a.userId) ?? [];
    return {
      ...r.a,
      userName: r.u?.name ?? null,
      userAvatar: r.u?.image ?? null,
      userEmail: r.a.userEmail || r.u?.email || null,
      effectiveCommissionPercent: getAffiliateCommissionPercent(r.a, rule),
      inviteCodes: inviteCodes.map((row) => ({
        code: row.code,
        isDefault: row.isDefault,
      })),
    };
  });
  return { items, total: Number(c?.count || 0) };
}

async function groupByUser<T extends { userId: string }>(
  table: any,
  userIds: string[],
  orderBy: any[]
): Promise<Map<string, T[]>> {
  const byUser = new Map<string, T[]>();
  const ids = [...new Set(userIds.filter(Boolean))];
  // D1 caps bound parameters per statement: chunk the id list.
  for (let i = 0; i < ids.length; i += 90) {
    const rows = (await db()
      .select()
      .from(table)
      .where(inArray(table.userId, ids.slice(i, i + 90)))
      .orderBy(...orderBy)) as T[];
    for (const row of rows) {
      const list = byUser.get(row.userId);
      if (list) list.push(row);
      else byUser.set(row.userId, [row]);
    }
  }
  return byUser;
}

/** Review an application or set an affiliate's own cash commission %. */
export async function updateAffiliateUser(
  id: string,
  data: { status?: string; commissionPercent?: number }
): Promise<Result> {
  const [current] = await db()
    .select()
    .from(affiliateUser)
    .where(eq(affiliateUser.id, id))
    .limit(1);
  if (!current) return { ok: false, error: 'not_found' };

  const patch: Record<string, unknown> = {};
  if (data.status !== undefined) {
    if (!(AFFILIATE_USER_STATUSES as readonly string[]).includes(data.status))
      return { ok: false, error: 'invalid_status' };
    patch.status = data.status;
  }
  if (data.commissionPercent !== undefined) {
    const percent = Math.floor(data.commissionPercent);
    if (
      !Number.isFinite(percent) ||
      percent < 0 ||
      percent > AFFILIATE_MAX_COMMISSION_PERCENT
    )
      return { ok: false, error: 'invalid_percent' };
    patch.commissionPercent = percent;
  }
  if (!Object.keys(patch).length) return { ok: true };

  await db().update(affiliateUser).set(patch).where(eq(affiliateUser.id, id));
  if (patch.status === 'active') await ensureDefaultInviteCode(current.userId);
  return { ok: true };
}

export async function listInvitesAdmin({
  search,
  paid,
  page = 1,
  limit = 20,
}: {
  search?: string;
  paid?: string; // 'paid' | 'unpaid'
  page?: number;
  limit?: number;
}) {
  const inviter = alias(user, 'inviter');
  const invitee = alias(user, 'invitee');
  const firstPaid = firstPaidOrders();
  const where = and(
    keywordMatch(search, {
      contains: [inviter.email, invitee.email, affiliateInvite.inviteCode],
    }),
    paid === 'paid'
      ? isNotNull(order.id)
      : paid === 'unpaid'
        ? isNull(order.id)
        : undefined
  );
  const orderJoinOn = and(
    eq(order.userId, affiliateInvite.inviteUserId),
    eq(order.status, 'paid'),
    eq(order.createdAt, firstPaid.firstPaidAt)
  );

  const [rows, [c]] = await Promise.all([
    db()
      .select({
        invite: affiliateInvite,
        inviter: {
          name: inviter.name,
          email: inviter.email,
          image: inviter.image,
        },
        invitee: {
          name: invitee.name,
          email: invitee.email,
          image: invitee.image,
        },
        paidOrder: {
          id: order.id,
          orderNo: order.orderNo,
          amount: order.amount,
          currency: order.currency,
          paymentAmount: order.paymentAmount,
          paymentCurrency: order.paymentCurrency,
        },
        reward: {
          id: affiliateReward.id,
          rewardAmount: affiliateReward.rewardAmount,
          rewardCurrency: affiliateReward.rewardCurrency,
          status: affiliateReward.status,
        },
      })
      .from(affiliateInvite)
      .leftJoin(inviter, eq(inviter.id, affiliateInvite.userId))
      .leftJoin(invitee, eq(invitee.id, affiliateInvite.inviteUserId))
      .leftJoin(firstPaid, eq(firstPaid.userId, affiliateInvite.inviteUserId))
      .leftJoin(order, orderJoinOn)
      .leftJoin(affiliateReward, eq(affiliateReward.orderNo, order.orderNo))
      .where(where)
      .orderBy(desc(affiliateInvite.createdAt))
      .limit(limit)
      .offset((page - 1) * limit),
    db()
      .select({ count: count() })
      .from(affiliateInvite)
      .leftJoin(inviter, eq(inviter.id, affiliateInvite.userId))
      .leftJoin(invitee, eq(invitee.id, affiliateInvite.inviteUserId))
      .leftJoin(firstPaid, eq(firstPaid.userId, affiliateInvite.inviteUserId))
      .leftJoin(order, orderJoinOn)
      .where(where),
  ]);

  const items = rows.map((r: any) => ({
    id: r.invite.id,
    inviteCode: r.invite.inviteCode,
    createdAt: r.invite.createdAt,
    inviterUserId: r.invite.userId,
    inviterName: r.inviter?.name ?? null,
    inviterEmail: r.inviter?.email ?? null,
    inviterAvatar: r.inviter?.image ?? null,
    inviteeUserId: r.invite.inviteUserId,
    inviteeName: r.invitee?.name ?? null,
    inviteeEmail: r.invitee?.email ?? null,
    inviteeAvatar: r.invitee?.image ?? null,
    paid: !!r.paidOrder?.id,
    orderNo: r.paidOrder?.orderNo ?? null,
    firstPaidAmount: r.paidOrder?.paymentAmount ?? r.paidOrder?.amount ?? null,
    firstPaidCurrency:
      r.paidOrder?.paymentCurrency ?? r.paidOrder?.currency ?? null,
    hasReward: !!r.reward?.id,
    rewardAmount: r.reward?.rewardAmount ?? null,
    rewardCurrency: r.reward?.rewardCurrency ?? null,
    rewardStatus: r.reward?.status ?? null,
  }));
  return { items, total: Number(c?.count || 0) };
}

export async function listRewardsAdmin({
  search,
  rewardType,
  status,
  page = 1,
  limit = 20,
}: {
  search?: string;
  rewardType?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  const payer = alias(user, 'payer');
  const where = and(
    keywordMatch(search, {
      contains: [
        user.email,
        affiliateReward.transactionNo,
        affiliateReward.orderNo,
      ],
    }),
    rewardType ? eq(affiliateReward.rewardType, rewardType) : undefined,
    status ? eq(affiliateReward.status, status) : undefined
  );

  const [rows, [c]] = await Promise.all([
    db()
      .select({
        reward: affiliateReward,
        affiliate: { name: user.name, email: user.email, image: user.image },
        order: {
          amount: order.amount,
          currency: order.currency,
          paymentAmount: order.paymentAmount,
          paymentCurrency: order.paymentCurrency,
          productName: order.productName,
        },
        payer: { name: payer.name, email: payer.email, image: payer.image },
      })
      .from(affiliateReward)
      .leftJoin(user, eq(user.id, affiliateReward.userId))
      .leftJoin(order, eq(order.orderNo, affiliateReward.orderNo))
      .leftJoin(payer, eq(payer.id, order.userId))
      .where(where)
      .orderBy(desc(affiliateReward.createdAt))
      .limit(limit)
      .offset((page - 1) * limit),
    db()
      .select({ count: count() })
      .from(affiliateReward)
      .leftJoin(user, eq(user.id, affiliateReward.userId))
      .where(where),
  ]);

  const items = rows.map((r: any) => ({
    ...r.reward,
    affiliateName: r.affiliate?.name ?? null,
    affiliateEmail: r.affiliate?.email ?? null,
    affiliateAvatar: r.affiliate?.image ?? null,
    paidAmount: r.order?.paymentAmount ?? r.order?.amount ?? null,
    paidCurrency: r.order?.paymentCurrency ?? r.order?.currency ?? null,
    productName: r.order?.productName ?? null,
    paidUserName: r.payer?.name ?? null,
    paidUserEmail: r.payer?.email ?? null,
    paidUserAvatar: r.payer?.image ?? null,
  }));
  return { items, total: Number(c?.count || 0) };
}

/**
 * Grant a commission by hand for an invitee's first paid order (e.g. the
 * automatic one was missed). One reward per order: the same unique key as the
 * automatic one, so it can never pay twice.
 */
export async function createRewardForInvite(
  inviteId: string,
  data: { rewardType: 'fixed' | 'percent'; amount?: number; percent?: number }
): Promise<Result> {
  const [invite] = await db()
    .select()
    .from(affiliateInvite)
    .where(eq(affiliateInvite.id, inviteId))
    .limit(1);
  if (!invite) return { ok: false, error: 'invite_not_found' };

  const inviter = await findAffiliateUserByUserId(invite.userId);
  if (!inviter) return { ok: false, error: 'inviter_not_found' };

  const [paidOrder] = await db()
    .select()
    .from(order)
    .where(and(eq(order.userId, invite.inviteUserId), eq(order.status, 'paid')))
    .orderBy(asc(order.createdAt))
    .limit(1);
  if (!paidOrder) return { ok: false, error: 'no_paid_order' };

  const paid = paidOrder.paymentAmount ?? paidOrder.amount ?? 0;
  let rewardPercent = 0;
  let rewardAmount = 0;
  if (data.rewardType === 'percent') {
    rewardPercent = Math.floor(data.percent ?? 0);
    if (rewardPercent <= 0 || rewardPercent > 100)
      return { ok: false, error: 'invalid_amount' };
    rewardAmount = percentOf(paid, rewardPercent);
  } else {
    rewardAmount = Math.floor(data.amount ?? 0);
  }
  if (
    !Number.isFinite(rewardAmount) ||
    rewardAmount <= 0 ||
    rewardAmount > paid
  )
    return { ok: false, error: 'invalid_amount' };

  const transactionNo = `aff_${paidOrder.orderNo}`;
  const [existing] = await db()
    .select({ id: affiliateReward.id })
    .from(affiliateReward)
    .where(eq(affiliateReward.transactionNo, transactionNo))
    .limit(1);
  if (existing) return { ok: false, error: 'reward_exists' };

  try {
    await db()
      .insert(affiliateReward)
      .values({
        id: getUuid(),
        transactionNo,
        userId: inviter.userId,
        orderNo: paidOrder.orderNo,
        rewardType: 'manual',
        rewardPercent,
        rewardAmount,
        rewardCurrency: (
          paidOrder.paymentCurrency ||
          paidOrder.currency ||
          'usd'
        ).toUpperCase(),
        rewardScene: 'invitee_paid',
        status: 'active',
      });
  } catch (error) {
    const [again] = await db()
      .select({ id: affiliateReward.id })
      .from(affiliateReward)
      .where(eq(affiliateReward.transactionNo, transactionNo))
      .limit(1);
    if (again) return { ok: false, error: 'reward_exists' };
    throw error;
  }
  return { ok: true };
}

export async function listWithdrawsAdmin({
  search,
  status,
  page = 1,
  limit = 20,
}: {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  const where = and(
    keywordMatch(search, {
      contains: [user.email, user.name, affiliateWithdraw.transactionNo],
    }),
    status ? eq(affiliateWithdraw.status, status) : undefined
  );

  const [rows, [c]] = await Promise.all([
    db()
      .select({
        w: affiliateWithdraw,
        u: { name: user.name, email: user.email, image: user.image },
      })
      .from(affiliateWithdraw)
      .leftJoin(user, eq(user.id, affiliateWithdraw.userId))
      .where(where)
      .orderBy(desc(affiliateWithdraw.createdAt))
      .limit(limit)
      .offset((page - 1) * limit),
    db()
      .select({ count: count() })
      .from(affiliateWithdraw)
      .leftJoin(user, eq(user.id, affiliateWithdraw.userId))
      .where(where),
  ]);

  const items = rows.map((r: any) => ({
    ...r.w,
    userName: r.u?.name ?? null,
    userEmail: r.u?.email ?? null,
    userAvatar: r.u?.image ?? null,
  }));
  return { items, total: Number(c?.count || 0) };
}

/**
 * Settle a payout request: `success` once paid by hand, `rejected` to return
 * the amount to the balance. Only a pending request changes status, so a
 * double click can't flip a paid one back. The remark can change any time.
 */
export async function updateAffiliateWithdraw(
  id: string,
  data: { status?: string; remark?: string }
): Promise<Result> {
  const [current] = await db()
    .select({ id: affiliateWithdraw.id, status: affiliateWithdraw.status })
    .from(affiliateWithdraw)
    .where(eq(affiliateWithdraw.id, id))
    .limit(1);
  if (!current) return { ok: false, error: 'not_found' };

  const patch: Record<string, unknown> = {};
  if (data.remark !== undefined) patch.remark = data.remark.slice(0, 1000);
  const changesStatus =
    data.status !== undefined && data.status !== current.status;
  if (changesStatus) {
    if (data.status !== 'success' && data.status !== 'rejected')
      return { ok: false, error: 'invalid_status' };
    patch.status = data.status;
  }
  if (!Object.keys(patch).length) return { ok: true };

  try {
    await atomic((q) => [
      changesStatus &&
        guard({
          table: affiliateWithdraw,
          column: 'userId',
          where: eq(affiliateWithdraw.id, id),
          require: eq(affiliateWithdraw.status, 'pending'),
          message: 'already_processed',
        }),
      q
        .update(affiliateWithdraw)
        .set(patch)
        .where(eq(affiliateWithdraw.id, id)),
    ]);
  } catch (error) {
    if (error instanceof AtomicGuardError)
      return { ok: false, error: error.message };
    throw error;
  }
  return { ok: true };
}

/** One affiliate's summary for the admin detail dialog. */
export async function getAffiliateDetailAdmin(userId: string) {
  const [affiliate, detail, inviteCodes] = await Promise.all([
    findAffiliateUserByUserId(userId),
    getRewardDetail({ userId }),
    listInviteCodes({ userId }),
  ]);
  return {
    affiliate: affiliate
      ? {
          ...affiliate,
          effectiveCommissionPercent: getAffiliateCommissionPercent(
            affiliate,
            await getRewardRule()
          ),
        }
      : null,
    ...detail,
    inviteCodes,
  };
}

// ─── Admin: statistics ────────────────────────────────────────────────────────

type AffiliateStatisticsTotals = {
  userId: string;
  userName: string;
  userEmail: string;
  userAvatar: string | null;
  inviteCount: number;
  paidCount: number;
  paidFromNewInvites: number;
  paidFromOldInvites: number;
  invitePaidCount: number;
  paidRate: number;
  rewardAmount: number;
  withdrawAmount: number;
};

/**
 * Ranking of affiliates over a time range. Each source is aggregated before
 * the join, avoiding invite × reward × withdrawal fan-out. `currency` is a
 * 3-letter code (amounts in that currency only) or 'ALL' (every currency
 * converted to USD at reference rates, for ranking only).
 */
export async function listAffiliateStatisticsAdmin({
  sortBy = 'inviteCount',
  currency = 'USD',
  search = '',
  page = 1,
  limit = 20,
  exchangeRates,
  timeRange = 'all',
}: {
  sortBy?: 'inviteCount' | 'paidRate' | 'rewardAmount' | 'withdrawAmount';
  currency?: string;
  search?: string;
  page?: number;
  limit?: number;
  /** Tests pass fixed rates instead of fetching them. */
  exchangeRates?: UsdRates;
  timeRange?: 'all' | '24h' | '7d' | '30d';
}) {
  const durations = { '24h': 24, '7d': 168, '30d': 720 };
  const since =
    timeRange === 'all'
      ? undefined
      : new Date(Date.now() - durations[timeRange] * 3_600_000);
  // Orders without paidAt fall back to their creation time.
  const paymentTime = since
    ? or(
        gte(order.paidAt, since),
        and(isNull(order.paidAt), gte(order.createdAt, since))
      )
    : undefined;
  const linkedOrder = db()
    .select({ id: order.id })
    .from(order)
    .where(eq(order.orderNo, affiliateReward.orderNo));
  const rewardTime = since
    ? or(
        exists(
          db()
            .select({ id: order.id })
            .from(order)
            .where(
              and(
                eq(order.orderNo, affiliateReward.orderNo),
                eq(order.status, 'paid'),
                paymentTime
              )
            )
        ),
        and(not(exists(linkedOrder)), gte(affiliateReward.createdAt, since))
      )
    : undefined;
  const withdrawalTime = since
    ? gte(affiliateWithdraw.createdAt, since)
    : undefined;

  let conversion: UsdRates | undefined;
  if (currency === 'ALL') {
    const [rewardCurrencies, withdrawalCurrencies] = await Promise.all([
      db()
        .select({ currency: affiliateReward.rewardCurrency })
        .from(affiliateReward)
        .where(
          and(
            eq(affiliateReward.status, 'active'),
            ne(affiliateReward.rewardAmount, 0),
            rewardTime
          )
        )
        .groupBy(affiliateReward.rewardCurrency),
      db()
        .select({ currency: affiliateWithdraw.currency })
        .from(affiliateWithdraw)
        .where(
          and(
            eq(affiliateWithdraw.status, 'success'),
            ne(affiliateWithdraw.amount, 0)
          )
        )
        .groupBy(affiliateWithdraw.currency),
    ]);
    const currencies = [
      ...new Set<string>(
        [...rewardCurrencies, ...withdrawalCurrencies].map(
          (row: { currency: string }) => row.currency.toUpperCase()
        )
      ),
    ];
    conversion = exchangeRates ?? (await getUsdRates(currencies));
    for (const code of currencies) {
      if (
        !/^[A-Z]{3}$/.test(code) ||
        !Number.isFinite(conversion.rates[code]) ||
        conversion.rates[code] <= 0
      )
        throw new Error('Missing or invalid reporting exchange rate');
    }
  }
  // Rates are server-owned (never client-supplied). Validated SQL literals
  // keep the statement under D1's bound-parameter limit.
  const rateCases = Object.entries(conversion?.rates ?? {}).map(
    ([code, rate]) => {
      if (!/^[A-Z]{3}$/.test(code) || !Number.isFinite(rate) || rate <= 0)
        throw new Error('Invalid reporting exchange rate');
      return sql.raw(`when '${code}' then ${rate}`);
    }
  );
  const rewardValue = conversion
    ? sql`sum(${affiliateReward.rewardAmount} * (case upper(${affiliateReward.rewardCurrency}) ${sql.join(rateCases, sql` `)} else 0 end))`
    : sum(affiliateReward.rewardAmount);
  const withdrawalValue = conversion
    ? sql`sum(${affiliateWithdraw.amount} * (case upper(${affiliateWithdraw.currency}) ${sql.join(rateCases, sql` `)} else 0 end))`
    : sum(affiliateWithdraw.amount);

  // One row per paying invitee, regardless of repeat purchases or currency.
  const paidUsers = db()
    .select({ userId: order.userId })
    .from(order)
    .where(eq(order.status, 'paid'))
    .groupBy(order.userId)
    .as('paid_invitees');
  const invites = db()
    .select({
      userId: affiliateInvite.userId,
      value: count().as('invite_count'),
      paidCount: count(paidUsers.userId).as('paid_count'),
    })
    .from(affiliateInvite)
    .leftJoin(paidUsers, eq(paidUsers.userId, affiliateInvite.inviteUserId))
    .where(since ? gte(affiliateInvite.createdAt, since) : undefined)
    .groupBy(affiliateInvite.userId)
    .as('invite_stats');
  const rewards = db()
    .select({
      userId: affiliateReward.userId,
      value: rewardValue.as('reward_amount'),
    })
    .from(affiliateReward)
    .where(
      and(
        eq(affiliateReward.status, 'active'),
        rewardTime,
        conversion
          ? undefined
          : sql`upper(${affiliateReward.rewardCurrency}) = ${currency}`
      )
    )
    .groupBy(affiliateReward.userId)
    .as('reward_stats');
  const withdrawals = db()
    .select({
      userId: affiliateWithdraw.userId,
      value: withdrawalValue.as('withdraw_amount'),
    })
    .from(affiliateWithdraw)
    .where(
      and(
        eq(affiliateWithdraw.status, 'success'),
        withdrawalTime,
        conversion
          ? undefined
          : sql`upper(${affiliateWithdraw.currency}) = ${currency}`
      )
    )
    .groupBy(affiliateWithdraw.userId)
    .as('withdraw_stats');

  // Attribute each paid order to one affiliate (its reward, or the payer's
  // inviter), then split payers into new invitees (invited in the range) and
  // older invitees.
  const paymentReward = alias(affiliateReward, 'payment_reward');
  const paymentInvite = alias(affiliateInvite, 'payment_invite');
  const payerInvite = alias(affiliateInvite, 'payer_invite');
  const paymentOwner = sql<string>`coalesce(${paymentReward.userId}, ${paymentInvite.userId})`;
  const newInvitee = since ? gte(payerInvite.createdAt, since) : sql`1 = 1`;
  const paymentStats = db()
    .select({
      userId: paymentOwner.as('payment_owner_id'),
      value: countDistinct(order.userId).as('payment_count'),
      newInvites:
        sql<number>`count(distinct case when ${payerInvite.id} is not null and ${newInvitee} then ${order.userId} end)`.as(
          'payment_new_invites'
        ),
      oldInvites:
        sql<number>`count(distinct case when ${payerInvite.id} is not null and not (${newInvitee}) then ${order.userId} end)`.as(
          'payment_old_invites'
        ),
    })
    .from(order)
    .leftJoin(paymentReward, eq(paymentReward.orderNo, order.orderNo))
    .leftJoin(paymentInvite, eq(paymentInvite.inviteUserId, order.userId))
    .leftJoin(
      payerInvite,
      and(
        eq(payerInvite.inviteUserId, order.userId),
        sql`${payerInvite.userId} = ${paymentOwner}`
      )
    )
    .where(
      and(
        eq(order.status, 'paid'),
        paymentTime,
        or(isNull(paymentReward.id), eq(paymentReward.status, 'active'))
      )
    )
    .groupBy(paymentOwner)
    .as('payment_stats');

  const metrics = {
    inviteCount: sql<number>`coalesce(${invites.value}, 0)`.mapWith(Number),
    paidCount: sql<number>`coalesce(${paymentStats.value}, 0)`.mapWith(Number),
    paidFromNewInvites:
      sql<number>`coalesce(${paymentStats.newInvites}, 0)`.mapWith(Number),
    paidFromOldInvites:
      sql<number>`coalesce(${paymentStats.oldInvites}, 0)`.mapWith(Number),
    invitePaidCount: sql<number>`coalesce(${invites.paidCount}, 0)`.mapWith(
      Number
    ),
    // Decimal division avoids integer truncation; rank before pagination.
    paidRate:
      sql<number>`coalesce(1.0 * ${invites.paidCount} / nullif(${invites.value}, 0), 0)`.mapWith(
        Number
      ),
    rewardAmount: sql<number>`coalesce(${rewards.value}, 0)`.mapWith(Number),
    withdrawAmount: sql<number>`coalesce(${withdrawals.value}, 0)`.mapWith(
      Number
    ),
  };
  // Keep affiliates with business in the range even without new invitations.
  const where = and(
    eq(user.type, 'user'),
    or(
      exists(
        db()
          .select({ id: affiliateInvite.id })
          .from(affiliateInvite)
          .where(
            and(
              eq(affiliateInvite.userId, user.id),
              since ? gte(affiliateInvite.createdAt, since) : undefined
            )
          )
      ),
      isNotNull(paymentStats.userId),
      exists(
        db()
          .select({ id: affiliateReward.id })
          .from(affiliateReward)
          .where(
            and(
              eq(affiliateReward.userId, user.id),
              eq(affiliateReward.status, 'active'),
              rewardTime
            )
          )
      ),
      exists(
        db()
          .select({ id: affiliateWithdraw.id })
          .from(affiliateWithdraw)
          .where(
            and(
              eq(affiliateWithdraw.userId, user.id),
              eq(affiliateWithdraw.status, 'success'),
              withdrawalTime
            )
          )
      )
    ),
    keywordMatch(search, { contains: [user.email, user.name] })
  );

  const [items, totals] = await Promise.all([
    db()
      .select({
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userAvatar: user.image,
        ...metrics,
      })
      .from(user)
      .leftJoin(invites, eq(invites.userId, user.id))
      .leftJoin(paymentStats, eq(paymentStats.userId, user.id))
      .leftJoin(rewards, eq(rewards.userId, user.id))
      .leftJoin(withdrawals, eq(withdrawals.userId, user.id))
      .where(where)
      .orderBy(desc(metrics[sortBy]), asc(user.id))
      .limit(limit)
      .offset((page - 1) * limit),
    db()
      .select({ total: count() })
      .from(user)
      .leftJoin(paymentStats, eq(paymentStats.userId, user.id))
      .where(where),
  ]);

  type GroupedTotal = CurrencyAmount & { userId: string };
  const rewardBreakdown = new Map<string, CurrencyAmount[]>();
  const withdrawalBreakdown = new Map<string, CurrencyAmount[]>();
  if (currency === 'ALL' && items.length) {
    const userIds = (items as AffiliateStatisticsTotals[]).map(
      (item) => item.userId
    );
    // Original-currency totals for this page only, chunked for D1.
    for (let offset = 0; offset < userIds.length; offset += 90) {
      const ids = userIds.slice(offset, offset + 90);
      const [rewardRows, withdrawalRows] = await Promise.all([
        db()
          .select({
            userId: affiliateReward.userId,
            currency: sql<string>`upper(${affiliateReward.rewardCurrency})`,
            amount: sum(affiliateReward.rewardAmount).mapWith(Number),
          })
          .from(affiliateReward)
          .where(
            and(
              inArray(affiliateReward.userId, ids),
              eq(affiliateReward.status, 'active'),
              rewardTime
            )
          )
          .groupBy(
            affiliateReward.userId,
            sql`upper(${affiliateReward.rewardCurrency})`
          ),
        db()
          .select({
            userId: affiliateWithdraw.userId,
            currency: sql<string>`upper(${affiliateWithdraw.currency})`,
            amount: sum(affiliateWithdraw.amount).mapWith(Number),
          })
          .from(affiliateWithdraw)
          .where(
            and(
              inArray(affiliateWithdraw.userId, ids),
              eq(affiliateWithdraw.status, 'success'),
              withdrawalTime
            )
          )
          .groupBy(
            affiliateWithdraw.userId,
            sql`upper(${affiliateWithdraw.currency})`
          ),
      ]);
      for (const [rows, target] of [
        [rewardRows, rewardBreakdown],
        [withdrawalRows, withdrawalBreakdown],
      ] as [GroupedTotal[], Map<string, CurrencyAmount[]>][]) {
        for (const row of rows) {
          if (!row.currency || !row.amount) continue;
          const amounts = target.get(row.userId) ?? [];
          amounts.push({ currency: row.currency, amount: row.amount });
          target.set(row.userId, amounts);
        }
      }
    }
  }
  const amountsFor = (item: AffiliateStatisticsTotals) => {
    const rewardAmounts =
      currency === 'ALL'
        ? (rewardBreakdown.get(item.userId) ?? [])
        : item.rewardAmount
          ? [{ currency, amount: item.rewardAmount }]
          : [];
    const withdrawAmounts =
      currency === 'ALL'
        ? (withdrawalBreakdown.get(item.userId) ?? [])
        : item.withdrawAmount
          ? [{ currency, amount: item.withdrawAmount }]
          : [];
    const unwithdrawnAmounts = rewardAmounts
      .map((reward) => ({
        currency: reward.currency,
        amount: Math.max(
          reward.amount -
            (withdrawAmounts.find((w) => w.currency === reward.currency)
              ?.amount ?? 0),
          0
        ),
      }))
      .filter((value) => value.amount > 0);
    return { rewardAmounts, withdrawAmounts, unwithdrawnAmounts };
  };

  return {
    items: (items as AffiliateStatisticsTotals[]).map((item, index) => {
      const amounts = amountsFor(item);
      return {
        ...item,
        ...amounts,
        rewardAmount: conversion
          ? Math.round(item.rewardAmount)
          : item.rewardAmount,
        withdrawAmount: conversion
          ? Math.round(item.withdrawAmount)
          : item.withdrawAmount,
        // Range rewards minus range payouts, floored per currency. Not the
        // available balance (that also reserves pending requests).
        unwithdrawnAmount: conversion
          ? Math.round(
              amounts.unwithdrawnAmounts.reduce(
                (total, value) =>
                  total + value.amount * conversion.rates[value.currency],
                0
              )
            )
          : amounts.unwithdrawnAmounts.reduce(
              (total, value) => total + value.amount,
              0
            ),
        rank: (page - 1) * limit + index + 1,
        currency: conversion ? 'USD' : currency,
      };
    }),
    total: Number(totals[0]?.total ?? 0),
    conversion: conversion
      ? { currency: 'USD', date: conversion.date, source: 'Frankfurter / ECB' }
      : null,
  };
}
