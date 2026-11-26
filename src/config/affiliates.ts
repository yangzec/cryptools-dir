/**
 * Affiliate program rules.
 *
 * Kept deliberately simple. An affiliate earns cash: a percentage of what a
 * referred buyer pays (default 20%, at most 50%; an admin may give one
 * affiliate their own percent within the same cap). Which payments earn is
 * the `scope`: the buyer's first payment (default), their first N, or every
 * payment including renewals. Only payments that charged money count, so a
 * free trial's $0 start isn't one. A paid order belongs to the buyer's
 * inviter (recorded at sign-up). Buyers get no discount from the program.
 *
 * A refunded order revokes its reward. Cash waits `holdDays` before it can be
 * withdrawn (`affiliate_reward.available_at`), so a refund in that window is
 * revoked before any payout.
 */

/** The highest commission percent (the rule's, or one affiliate's own). */
export const AFFILIATE_MAX_COMMISSION_PERCENT = 50;

/** Which of a referred buyer's payments earn a commission. */
export const AFFILIATE_REWARD_SCOPES = ['first', 'first_n', 'all'] as const;
export type AffiliateRewardScope = (typeof AFFILIATE_REWARD_SCOPES)[number];

/** The most payments `first_n` may cover. */
export const AFFILIATE_MAX_REWARD_PAYMENTS = 120;

export type AffiliateRewardRule = {
  /** % of each earning payment (an affiliate may have their own). */
  percent: number;
  /** first: the first payment; first_n: the first `payments`; all: every one. */
  scope: AffiliateRewardScope;
  /** How many payments earn under `first_n`. */
  payments: number;
  /** Days after the payment before a cash reward can be withdrawn. */
  holdDays: number;
  /** Smallest withdrawable balance, minor units, by currency. */
  minWithdrawUsd: number;
  minWithdrawCny: number;
  /** URL parameter that carries an invite code (`?ref=<code>`). */
  inviteParam: string;
};

export const DEFAULT_AFFILIATE_REWARD_RULE: AffiliateRewardRule = {
  percent: 20,
  scope: 'first',
  payments: 3,
  holdDays: 30,
  minWithdrawUsd: 5000, // $50
  minWithdrawCny: 30000, // ¥300
  inviteParam: 'ref',
};

/**
 * Invite parameter names an admin may choose: a letter, then letters,
 * digits, `_` or `-`. `utm_*` stays with UTM attribution.
 */
export function isValidInviteParam(name: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(name) && !/^utm_/i.test(name);
}

/**
 * Words an affiliate's own invite code may not contain (setting
 * `affiliate_reserved_codes`, one per line), e.g. brand names. Compared
 * without case, `-` or `_`, so `Ship-Any2025` hits `shipany`.
 */
export function parseReservedInviteWords(text: string | undefined): string[] {
  const words = (text || '')
    .split(/\r?\n/)
    .map(normalizeInviteWord)
    .filter(Boolean);
  return [...new Set(words)].slice(0, 1000);
}

function normalizeInviteWord(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[-_\s]/g, '');
}

export function isReservedInviteCode(code: string, words: string[]): boolean {
  const normalized = normalizeInviteWord(code);
  return words.some((word) => normalized.includes(word));
}

/** Cookie that remembers an invite link click until sign-up. */
export const AFFILIATE_INVITE_COOKIE = 'ivt';
export const AFFILIATE_INVITE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/** Invite codes ride in URLs, so they are limited to URL-safe characters. */
export const AFFILIATE_INVITE_CODE_PATTERN = /^[A-Za-z0-9_-]{3,32}$/;

function intSetting(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
  scale = 1
): number {
  if (value === undefined || value.trim() === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n * scale)));
}

/** The admin's reward settings, validated, with defaults for unset ones. */
export function getAffiliateRewardRule(
  configs: Record<string, string | undefined> | undefined
): AffiliateRewardRule {
  const c = configs || {};
  const d = DEFAULT_AFFILIATE_REWARD_RULE;
  return {
    percent: intSetting(
      c.affiliate_reward_percent,
      d.percent,
      0,
      AFFILIATE_MAX_COMMISSION_PERCENT
    ),
    scope: (AFFILIATE_REWARD_SCOPES as readonly string[]).includes(
      (c.affiliate_reward_scope || '').trim()
    )
      ? (c.affiliate_reward_scope!.trim() as AffiliateRewardScope)
      : d.scope,
    payments: intSetting(
      c.affiliate_reward_payments,
      d.payments,
      1,
      AFFILIATE_MAX_REWARD_PAYMENTS
    ),
    holdDays: intSetting(c.affiliate_hold_days, d.holdDays, 0, 3650),
    minWithdrawUsd: intSetting(
      c.affiliate_min_withdraw_usd,
      d.minWithdrawUsd,
      0,
      100_000_000,
      100
    ),
    minWithdrawCny: intSetting(
      c.affiliate_min_withdraw_cny,
      d.minWithdrawCny,
      0,
      100_000_000,
      100
    ),
    inviteParam: isValidInviteParam((c.affiliate_invite_param || '').trim())
      ? c.affiliate_invite_param!.trim()
      : d.inviteParam,
  };
}

/**
 * How many of a buyer's charged payments earn under the rule: 1, N, or
 * null for every one.
 */
export function rewardPaymentLimit(rule: AffiliateRewardRule): number | null {
  if (rule.scope === 'all') return null;
  return rule.scope === 'first_n' ? rule.payments : 1;
}

/** Effective commission percent for one affiliate (their own, else the rule's). */
export function getAffiliateCommissionPercent(
  row: { commissionPercent?: number | null } | null | undefined,
  rule: AffiliateRewardRule
): number {
  const own = row?.commissionPercent;
  return Math.min(
    own && own > 0 ? own : rule.percent,
    AFFILIATE_MAX_COMMISSION_PERCENT
  );
}

/** Smallest withdrawable balance for a currency (others use USD's). */
export function minWithdrawFor(
  rule: AffiliateRewardRule,
  currency: string
): number {
  return currency.toUpperCase() === 'CNY'
    ? rule.minWithdrawCny
    : rule.minWithdrawUsd;
}

/** When a cash reward earned at `now` becomes withdrawable (null = now). */
export function rewardAvailableAt(
  rule: AffiliateRewardRule,
  now = new Date()
): Date | null {
  return rule.holdDays > 0
    ? new Date(now.getTime() + rule.holdDays * 86_400_000)
    : null;
}

/** A percentage of an amount in minor units (rounded down). */
export function percentOf(amount: number, percent: number): number {
  return Math.floor((Math.max(0, amount) * Math.max(0, percent)) / 100);
}
