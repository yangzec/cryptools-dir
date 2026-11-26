import { ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';

import { Link } from '@/core/i18n/navigation';
import { m } from '@/paraglide/messages.js';
import { getLocale } from '@/paraglide/runtime.js';

export type CurrencyAmount = { currency: string; amount: number };

/** Minor units → "$12.34" in the viewer's locale. */
export function formatMoney(amount: number, currency: string) {
  const code = (currency || 'usd').toUpperCase();
  try {
    return new Intl.NumberFormat(getLocale(), {
      style: 'currency',
      currency: code,
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${code}`;
  }
}

/** Per-currency totals → "$12.00 + ¥30.00", or a zero amount when empty. */
export function formatAmounts(list?: CurrencyAmount[] | null) {
  const items = (list || []).filter((item) => item.amount > 0);
  if (!items.length) return formatMoney(0, 'USD');
  return items
    .map((item) => formatMoney(item.amount, item.currency))
    .join(' + ');
}

/**
 * An invite link: the home page with `?<param>=<code>` (param is an admin
 * setting, default `ref`). It works on any page of the site (src/server.ts),
 * so affiliates can append it to the page they want to share.
 */
export function inviteLinkOf(code: string, param = 'ref') {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/?${param}=${encodeURIComponent(code)}`;
}

export async function copyText(text: string, successMessage: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMessage);
  } catch {
    toast.error(m['affiliates.copy_failed']());
  }
}

/** The API answers with error codes; turn them into a sentence. */
export function affiliateErrorMessage(code: string): string {
  switch (code) {
    case 'invalid_code':
      return m['affiliates.errors.invalid_invite_code']();
    case 'reserved_code':
      return m['affiliates.errors.reserved_code']();
    case 'code_taken':
      return m['affiliates.errors.code_taken']();
    case 'not_applied':
    case 'not_approved':
      return m['affiliates.errors.not_approved']();
    case 'not_found':
      return m['affiliates.errors.not_found']();
    case 'too_many':
      return m['affiliates.errors.too_many']();
    case 'no_balance':
      return m['affiliates.errors.no_balance']();
    case 'pending_exists':
      return m['affiliates.errors.pending_exists']();
    case 'description_required':
      return m['affiliates.errors.description_required']();
    case 'reason_required':
      return m['affiliates.errors.reason_required']();
    default:
      return code || m['affiliates.errors.unknown']();
  }
}

export function BackToAffiliates() {
  return (
    <Link
      href="/settings/affiliates"
      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
    >
      <ChevronLeft className="size-4" />
      {m['affiliates.back']()}
    </Link>
  );
}
