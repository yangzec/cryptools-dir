import type { ReactNode } from 'react';

import { tDynamic } from '@/core/i18n/dynamic';
import { m } from '@/paraglide/messages.js';

export type Subscription = {
  id: string;
  subscriptionNo: string;
  status: string;
  paymentProvider: string;
  productId?: string | null;
  planName?: string | null;
  productName?: string | null;
  /** Sponsor ad name when this subscription is a directory seat. */
  resourceLabel?: string | null;
  interval?: string | null;
  intervalCount?: number | null;
  amount?: number | null;
  currency?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  canceledAt?: string | null;
  canceledEndAt?: string | null;
  canceledReason?: string | null;
  createdAt?: string | null;
};

export const TABS = [
  'all',
  'active',
  'trialing',
  'paused',
  'expired',
  'pending_cancel',
  'canceled',
] as const;
export type Tab = (typeof TABS)[number];

export const PAGE_SIZE = 20;

export function formatAmount(amount: number, currency: string) {
  const normalized = (currency || 'usd').toUpperCase();
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: normalized,
  }).format(amount / 100);
}

export function statusVariant(
  status?: string | null
): 'default' | 'secondary' | 'destructive' | 'outline' {
  const s = (status || '').toLowerCase();
  if (s === 'active' || s === 'trialing') return 'default';
  if (s === 'canceled' || s === 'expired') return 'destructive';
  return 'secondary';
}

export function isCancellable(status?: string | null) {
  const s = (status || '').toLowerCase();
  return s === 'active' || s === 'trialing';
}

/** Localize subscription status; reuse tab_* labels already in messages. */
export function statusLabel(status?: string | null) {
  const s = (status || '').toLowerCase();
  if (!s) return '—';
  const key = `settings.billing.tab_${s}`;
  const label = tDynamic(key);
  return label === key ? status || s : label;
}

/** Localize billing interval, e.g. "1 month" / "1 个月". */
export function formatInterval(
  interval?: string | null,
  intervalCount?: number | null
) {
  if (!interval) return '';
  const unit = interval.toLowerCase().replace(/_/g, '-');
  const count = intervalCount && intervalCount > 0 ? intervalCount : 1;
  const n = String(count);
  if (unit === 'one-time') return m['settings.billing.interval_one_time']();
  if (unit === 'day') {
    return count === 1
      ? m['settings.billing.interval_day']({ count: n })
      : m['settings.billing.interval_days']({ count: n });
  }
  if (unit === 'week') {
    return count === 1
      ? m['settings.billing.interval_week']({ count: n })
      : m['settings.billing.interval_weeks']({ count: n });
  }
  if (unit === 'month') {
    return count === 1
      ? m['settings.billing.interval_month']({ count: n })
      : m['settings.billing.interval_months']({ count: n });
  }
  if (unit === 'year') {
    return count === 1
      ? m['settings.billing.interval_year']({ count: n })
      : m['settings.billing.interval_years']({ count: n });
  }
  return count > 1 ? `${count} ${interval}` : interval;
}

export function isSponsorSubscription(sub: { productId?: string | null }) {
  return Boolean(sub.productId?.startsWith('directory_sponsor_'));
}

export function subscriptionTitle(sub: Subscription) {
  const plan = sub.planName || sub.productName || '—';
  if (sub.resourceLabel) return `${plan} · ${sub.resourceLabel}`;
  return plan;
}

export function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-muted-foreground w-32 shrink-0">{label}</span>
      <span className="flex-1">{children}</span>
    </div>
  );
}
