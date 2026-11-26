import { matchPermission } from '@/core/auth/rbac';
import { tDynamic } from '@/core/i18n/dynamic';
import { ApiError } from '@/lib/api-client';
import { formatDateTime } from '@/lib/time';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { useUserPermissions } from '@/hooks/use-user-permissions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

export type CurrencyAmount = { currency: string; amount: number };

export const AFFILIATE_STATUSES = ['pending', 'active', 'rejected'] as const;
export const WITHDRAW_STATUSES = ['pending', 'success', 'rejected'] as const;
export const REWARD_TYPES = ['cash', 'manual'] as const;
export const REWARD_STATUSES = ['active', 'revoked'] as const;

/**
 * Money in minor units. Same formatter as the admin overview: the divisor
 * comes from the currency itself, so zero-decimal currencies (JPY, KRW…)
 * aren't divided by 100.
 */
export function formatMoney(amount: number, currency: string) {
  try {
    const fmt = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: (currency || 'USD').toUpperCase(),
    });
    const digits = fmt.resolvedOptions().maximumFractionDigits ?? 2;
    return fmt.format(amount / 10 ** digits);
  } catch {
    return `${(amount / 100).toFixed(2)} ${(currency || '').toUpperCase()}`;
  }
}

/** Fraction digits of a currency (2 for USD, 0 for JPY). */
export function currencyDigits(currency: string) {
  try {
    return (
      new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: (currency || 'USD').toUpperCase(),
      }).resolvedOptions().maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

export function formatAmounts(amounts?: CurrencyAmount[] | null) {
  const positive = (amounts ?? []).filter((a) => a.amount > 0);
  if (!positive.length) return '—';
  return positive.map((a) => formatMoney(a.amount, a.currency)).join(' + ');
}

/** Amount cell: "—" when empty, colored by meaning. */
export function MoneyText({
  amount,
  currency,
  tone,
  strike,
}: {
  amount?: number | null;
  currency?: string | null;
  tone?: 'positive' | 'muted';
  strike?: boolean;
}) {
  if (!amount) return <span className="text-muted-foreground">—</span>;
  return (
    <span
      className={cn(
        'whitespace-nowrap tabular-nums',
        tone === 'positive' && 'text-emerald-700 dark:text-emerald-400',
        tone === 'muted' && 'text-muted-foreground',
        strike && 'line-through'
      )}
    >
      {formatMoney(amount, currency || 'USD')}
    </span>
  );
}

/** A reward's value (struck through once revoked). */
export function RewardValue({
  reward,
}: {
  reward: {
    rewardType?: string | null;
    rewardAmount?: number | null;
    rewardCurrency?: string | null;
    status?: string | null;
  };
}) {
  const revoked = reward.status === 'revoked';
  return (
    <MoneyText
      amount={reward.rewardAmount}
      currency={reward.rewardCurrency}
      tone={revoked ? 'muted' : 'positive'}
      strike={revoked}
    />
  );
}

/**
 * Write controls follow the admin.affiliates.* permission codes. When the
 * permission summary doesn't list codes, the controls show and the API (which
 * always checks) has the final say.
 */
export function useAffiliatePermissions() {
  const { data } = useUserPermissions();
  const codes = data?.permissions;
  const can = (code: string) => (codes ? matchPermission(code, codes) : true);
  return {
    canWrite: can('admin.affiliates.write'),
    canReward: can('admin.affiliates.reward'),
    canWithdraw: can('admin.affiliates.withdraw'),
    canReadSettings: can('admin.settings.read'),
    canWriteSettings: can('admin.settings.write'),
  };
}

const KNOWN_ERRORS = [
  'already_processed',
  'reward_exists',
  'no_paid_order',
  'invalid_amount',
  'invalid_percent',
  'invalid_status',
  'not_found',
  'invite_not_found',
  'inviter_not_found',
];

/** API error codes (e.g. 'reward_exists') → translated text. */
export function affiliateErrorMessage(error: unknown) {
  const message =
    error instanceof ApiError || error instanceof Error ? error.message : '';
  if (KNOWN_ERRORS.includes(message))
    return tDynamic(`admin.affiliates.errors.${message}`);
  return message || m['admin.affiliates.toasts.save_failed']();
}

export function AffiliateStatusBadge({ status }: { status?: string | null }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  const variant =
    status === 'active'
      ? 'default'
      : status === 'rejected'
        ? 'destructive'
        : 'secondary';
  return (
    <Badge variant={variant}>
      {tDynamic(`admin.affiliates.status.${status}`)}
    </Badge>
  );
}

export function WithdrawStatusBadge({ status }: { status?: string | null }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  const variant =
    status === 'success'
      ? 'default'
      : status === 'rejected'
        ? 'destructive'
        : 'secondary';
  return (
    <Badge variant={variant}>
      {tDynamic(`admin.affiliates.withdraw_status.${status}`)}
    </Badge>
  );
}

export function RewardStatusBadge({ status }: { status?: string | null }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  return (
    <Badge variant={status === 'revoked' ? 'outline' : 'secondary'}>
      {tDynamic(`admin.affiliates.reward_status.${status}`)}
    </Badge>
  );
}

export function RewardTypeBadge({ type }: { type?: string | null }) {
  if (!type) return <span className="text-muted-foreground">—</span>;
  return (
    <Badge variant="outline">
      {tDynamic(`admin.affiliates.reward_type.${type}`)}
    </Badge>
  );
}

export function PaidBadge({ paid }: { paid: boolean }) {
  return paid ? (
    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
      {m['admin.affiliates.paid.paid']()}
    </Badge>
  ) : (
    <Badge variant="outline">{m['admin.affiliates.paid.unpaid']()}</Badge>
  );
}

/** Avatar + name (+ email) for rows that carry no user id to link to. */
export function PlainUser({
  name,
  email,
  image,
}: {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}) {
  if (!name && !email) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className="size-8">
        <AvatarImage src={image || undefined} />
        <AvatarFallback className="text-xs">
          {(name || email || '?').charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium">{name || '—'}</span>
        {email && (
          <span className="text-muted-foreground truncate text-xs">
            {email}
          </span>
        )}
      </div>
    </div>
  );
}

export function DateCell({ value }: { value?: string | Date | null }) {
  return (
    <span className="text-muted-foreground text-sm whitespace-nowrap">
      {formatDateTime(value)}
    </span>
  );
}

/** Underlined tab strip, same look as the other admin pages. */
export function TabStrip<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: readonly T[];
  value: T;
  onChange: (tab: T) => void;
  label: (tab: T) => string;
}) {
  return (
    <div className="border-border flex gap-1 overflow-x-auto overflow-y-hidden border-b">
      {tabs.map((tb) => (
        <button
          key={tb}
          type="button"
          onClick={() => onChange(tb)}
          className={cn(
            '-mb-px border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors',
            value === tb
              ? 'border-primary text-foreground'
              : 'text-muted-foreground hover:text-foreground border-transparent'
          )}
        >
          {label(tb)}
        </button>
      ))}
    </div>
  );
}
