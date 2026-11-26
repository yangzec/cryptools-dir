import { useEffect, useRef, useState } from 'react';
import { Link, useRouter } from '@tanstack/react-router';
import { ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

import { cancelPendingSponsorAdFn } from '@/modules/directory/server';
import type { MySponsorAdItem } from '@/modules/directory/user-actions';
import { SPONSOR_TIERS, tr } from '@/lib/directory-data';
import { saveSponsorRebookDraft } from '@/lib/directory/sponsor-rebook-draft';
import { m } from '@/paraglide/messages.js';
import { useConfirm } from '@/hooks/use-confirm';
import { useDirectoryCheckout } from '@/hooks/use-directory-checkout';
import { DirectoryListIcon } from '@/components/directory/DirectoryListIcon';
import { PaymentProviderModal } from '@/components/payment-provider-modal';

interface AdsListProps {
  items: MySponsorAdItem[];
}

const manageSubBtnClass =
  'border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-7 cursor-pointer items-center rounded-full border px-2.5 text-xs font-medium transition disabled:opacity-50';

export function AdsList({ items: initialItems }: AdsListProps) {
  const router = useRouter();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [items, setItems] = useState(initialItems);
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);
  const payingId = useRef<string | null>(null);
  const checkout = useDirectoryCheckout({
    kind: 'ad',
    resolveId: async () => {
      if (!payingId.current) throw new Error('Missing ad id');
      return payingId.current;
    },
    onError: (err) => {
      const code = err.message;
      if (code === 'sold_out') {
        toast.error(m['dir.sponsor.error_sold_out']());
      } else if (code === 'pending_expired') {
        toast.error(m['dir.sponsor.error_pending_expired']());
      } else if (code === 'pending_checkout') {
        toast.error(m['dir.sponsor.error_pending_checkout']());
      } else if (code === 'tier_already_held') {
        toast.error(m['dir.sponsor.error_tier_already_held']());
      } else if (code === 'common.checkout_failed') {
        toast.error(m['common.checkout_failed']());
      } else if (
        code === 'Ad not found' ||
        code === 'This ad is not awaiting payment'
      ) {
        toast.error(m['dir.sponsor.error_failed']());
      } else {
        const localized = code ? (m as any)[code] : null;
        toast.error(
          typeof localized === 'function'
            ? localized()
            : m['common.checkout_failed']()
        );
      }
    },
  });

  async function cancelPayment(ad: MySponsorAdItem) {
    const ok = await confirm({
      title: m['directory.settings_ads_cancel_payment'](),
      description: m['directory.settings_ads_cancel_payment_confirm'](),
      confirmLabel: m['directory.settings_ads_cancel_payment'](),
      destructive: true,
    });
    if (!ok) return;
    setCancelingId(ad.id);
    try {
      const result = await cancelPendingSponsorAdFn({
        data: { adId: ad.id },
      });
      if (!result.ok) {
        const code = result.error;
        if (code === 'not_pending') {
          toast.error(m['directory.settings_ads_cancel_payment_not_pending']());
        } else if (code === 'already_paid') {
          toast.error(m['directory.settings_ads_cancel_payment_not_pending']());
        } else {
          toast.error(m['directory.settings_ads_cancel_payment_failed']());
        }
        await router.invalidate();
        return;
      }
      setItems((prev) =>
        prev.map((row) =>
          row.id === ad.id ? { ...row, status: 'expired' as const } : row
        )
      );
      toast.success(m['directory.settings_ads_cancel_payment_success']());
      await router.invalidate();
    } catch {
      toast.error(m['directory.settings_ads_cancel_payment_failed']());
    } finally {
      setCancelingId(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className="group/card bg-card text-card-foreground ring-foreground/10 flex flex-col gap-4 overflow-hidden rounded-xl py-4 text-sm ring-1 has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:gap-3 data-[size=sm]:py-3 data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl">
        <div className="py-12 text-center">
          <p className="text-muted-foreground text-sm">
            {m['directory.settings_no_ads_desc']()}
          </p>
          <Link
            to={'/advertise' as any}
            hash="sponsors"
            className="bg-primary text-primary-foreground hover:bg-primary/90 mt-4 inline-flex h-7 items-center rounded-full px-3 text-xs font-medium transition"
          >
            <span>{m['directory.settings_become_sponsor']()}</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="group/card bg-card text-card-foreground ring-foreground/10 flex flex-col gap-4 overflow-hidden rounded-xl py-4 text-sm ring-1 has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:gap-3 data-[size=sm]:py-3 data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl">
      <div className="divide-border divide-y px-6">
        {items.map((ad) => {
          const isActive = ad.status === 'active';

          return (
            <div
              key={ad.id}
              className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <DirectoryListIcon src={ad.iconUrl} alt={ad.name} />

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <a
                      href={ad.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 truncate text-sm leading-none font-medium hover:underline"
                    >
                      <span>{ad.name}</span>
                      <ExternalLink className="text-muted-foreground size-3" />
                    </a>

                    {/* Tier Badge */}
                    <span className="border-border inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] leading-none font-medium">
                      {tr(`dir.sponsor.tier_${ad.tier.replace('-', '_')}`)}
                    </span>

                    {/* Status Badge */}
                    <span
                      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] leading-none font-medium ${
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-secondary-foreground'
                      }`}
                    >
                      {isActive
                        ? m['dir.sponsor.status_active']()
                        : ad.status === 'pending_payment'
                          ? m['directory.settings_status_pending_payment']()
                          : m['dir.sponsor.status_inactive']()}
                    </span>
                  </div>

                  <p className="text-muted-foreground mt-1 truncate text-xs">
                    {ad.tagline}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-2">
                {ad.status === 'pending_payment' ? (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={checkout.pending || cancelingId === ad.id}
                      onClick={() => void cancelPayment(ad)}
                      className={manageSubBtnClass}
                    >
                      {m['directory.settings_ads_cancel_payment']()}
                    </button>
                    <button
                      type="button"
                      disabled={checkout.pending || cancelingId === ad.id}
                      onClick={() => {
                        payingId.current = ad.id;
                        checkout.pay();
                      }}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-7 cursor-pointer items-center rounded-full px-2.5 text-xs font-medium transition disabled:opacity-50"
                    >
                      {m['dir.sponsor.continue_payment']({
                        price: `${SPONSOR_TIERS.find((t) => t.tier === ad.tier)?.price || ''}${m['dir.sponsor.per_month']()}`,
                      })}
                    </button>
                  </div>
                ) : null}
                {/* TTL-released hold (never went live): seat is free — book again. */}
                {ad.status === 'expired' && !ad.startsAt ? (
                  <Link
                    to={'/advertise' as any}
                    search={{ rebook: '1' } as any}
                    hash="sponsors"
                    className={manageSubBtnClass}
                    onClick={() => {
                      saveSponsorRebookDraft({
                        name: ad.name,
                        tagline: ad.tagline,
                        url: ad.url,
                        iconUrl: ad.iconUrl || undefined,
                        tier: ad.tier,
                      });
                    }}
                  >
                    {m['dir.sponsor.rebook_after_timeout']()}
                  </Link>
                ) : null}
                <p className="text-muted-foreground text-xs tabular-nums">
                  {ad.startsAt && ad.endsAt
                    ? `${ad.startsAt.slice(0, 10)} — ${ad.endsAt.slice(0, 10)}`
                    : ad.createdAt.slice(0, 10)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <PaymentProviderModal {...checkout.pickerProps} />
      {confirmDialog}
    </div>
  );
}
