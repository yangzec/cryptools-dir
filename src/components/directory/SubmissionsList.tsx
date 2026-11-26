import { useRef } from 'react';
import { Link } from '@tanstack/react-router';
import { Crown, ExternalLink, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import type { MySubmissionItem } from '@/modules/directory/user-actions';
import { SUBMIT_TIERS } from '@/lib/directory/submit-sponsor-config';
import { m } from '@/paraglide/messages.js';
import { localizeHref } from '@/paraglide/runtime.js';
import { useDirectoryCheckout } from '@/hooks/use-directory-checkout';
import { DirectoryListIcon } from '@/components/directory/DirectoryListIcon';
import { PaymentProviderModal } from '@/components/payment-provider-modal';

interface SubmissionsListProps {
  items: MySubmissionItem[];
}

function statusLabel(status: MySubmissionItem['status']) {
  if (status === 'published') return m['directory.settings_status_published']();
  if (status === 'pending_payment') {
    return m['directory.settings_status_pending_payment']();
  }
  if (status === 'rejected') {
    return m['directory.settings_status_rejected']();
  }
  return m['directory.settings_status_pending']();
}

const premiumPrice =
  SUBMIT_TIERS.find((t) => t.id === 'premium')?.price || '$39';

export function SubmissionsList({ items }: SubmissionsListProps) {
  const payingId = useRef<string | null>(null);
  const checkout = useDirectoryCheckout({
    kind: 'tool',
    resolveId: async () => {
      if (!payingId.current) throw new Error('Missing submission id');
      return payingId.current;
    },
    onError: (err) => {
      const code = err.message;
      if (code === 'common.checkout_failed') {
        toast.error(m['common.checkout_failed']());
        return;
      }
      if (
        code === 'Submission not found' ||
        code === 'This submission is not awaiting payment' ||
        code === 'Only premium submissions require payment'
      ) {
        toast.error(m['dir.submit.error_failed']());
        return;
      }
      const localized = code ? (m as any)[code] : null;
      toast.error(
        typeof localized === 'function'
          ? localized()
          : m['common.checkout_failed']()
      );
    },
  });

  if (items.length === 0) {
    return (
      <div className="group/card bg-card text-card-foreground ring-foreground/10 flex flex-col gap-4 overflow-hidden rounded-xl py-4 text-sm ring-1 has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:gap-3 data-[size=sm]:py-3 data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl">
        <div className="py-12 text-center">
          <p className="text-muted-foreground text-sm">
            {m['directory.settings_no_submissions_desc']()}
          </p>
          <Link
            to={'/submit' as any}
            className="bg-primary text-primary-foreground hover:bg-primary/90 mt-4 inline-flex h-7 items-center rounded-full px-3 text-xs font-medium transition"
          >
            <span>{m['directory.settings_submit_first']()}</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="group/card bg-card text-card-foreground ring-foreground/10 flex flex-col gap-4 overflow-hidden rounded-xl py-4 text-sm ring-1 has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:gap-3 data-[size=sm]:py-3 data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl">
      <div className="divide-border divide-y px-6">
        {items.map((item) => {
          const isFeatured =
            item.featured ||
            (!!item.featuredUntil && new Date(item.featuredUntil) > new Date());
          const isPublished = item.status === 'published';

          return (
            <div
              key={item.id}
              className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <DirectoryListIcon src={item.iconUrl} alt={item.name} />

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <a
                      href={localizeHref(
                        isPublished
                          ? `/tools/${item.slug}`
                          : `/tools/${item.slug}?preview=1`
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-sm leading-none font-medium hover:underline"
                    >
                      {item.name}
                    </a>

                    <span
                      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] leading-none font-medium ${
                        isPublished
                          ? 'bg-primary text-primary-foreground'
                          : item.status === 'rejected'
                            ? 'bg-destructive/15 text-destructive'
                            : 'bg-secondary text-secondary-foreground'
                      }`}
                    >
                      {statusLabel(item.status)}
                    </span>

                    {(item.paidAt || item.plan === 'premium') && (
                      <span className="border-border text-foreground inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] leading-none font-medium">
                        <Crown className="size-2.5 text-amber-500" />
                        <span>{m['dir.submit.plan_premium']()}</span>
                      </span>
                    )}

                    {isFeatured && (
                      <span className="border-border text-foreground inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] leading-none font-medium">
                        <Sparkles className="size-2.5 text-amber-500" />
                        <span>{m['directory.featured']()}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground mt-1 truncate text-xs">
                    {item.tagline || item.slug}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                <a
                  href={
                    isPublished
                      ? localizeHref(`/tools/${item.slug}`)
                      : localizeHref(`/tools/${item.slug}?preview=1`)
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:bg-muted text-foreground inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-medium transition"
                >
                  <ExternalLink className="size-3" />
                  <span>
                    {isPublished
                      ? m['directory.view']()
                      : m['directory.preview']()}
                  </span>
                </a>
                {!isPublished && item.websiteUrl ? (
                  <a
                    href={item.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:bg-muted text-foreground inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-medium transition"
                  >
                    <ExternalLink className="size-3" />
                    <span>{m['directory.visit_website']()}</span>
                  </a>
                ) : null}

                {item.status === 'pending_payment' && (
                  <button
                    type="button"
                    disabled={checkout.pending}
                    onClick={() => {
                      payingId.current = item.id;
                      checkout.pay();
                    }}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-7 cursor-pointer items-center gap-1 rounded-full px-2.5 text-xs font-medium transition disabled:opacity-50"
                  >
                    <Crown className="size-3 text-amber-500" />
                    <span>
                      {m['dir.submit.btn_pay']({ price: premiumPrice })}
                    </span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <PaymentProviderModal {...checkout.pickerProps} />
    </div>
  );
}
