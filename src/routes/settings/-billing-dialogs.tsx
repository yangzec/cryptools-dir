import { m } from '@/paraglide/messages.js';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import {
  DetailRow,
  formatAmount,
  formatInterval,
  statusLabel,
  statusVariant,
  subscriptionTitle,
  type Subscription,
} from './-billing-shared';

export function BillingDialogs({
  viewing,
  setViewing,
  canceling,
  setCanceling,
  confirmCancel,
  submitting,
}: {
  viewing: Subscription | null;
  setViewing: (v: Subscription | null) => void;
  canceling: Subscription | null;
  setCanceling: (v: Subscription | null) => void;
  confirmCancel: () => void;
  submitting: boolean;
}) {
  return (
    <>
      <Dialog open={!!viewing} onOpenChange={(v) => !v && setViewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {m['settings.billing.subscription_details']()}
            </DialogTitle>
            <DialogDescription className="font-mono text-xs">
              {viewing?.subscriptionNo}
            </DialogDescription>
          </DialogHeader>
          {viewing && (
            <div className="space-y-3 py-2 text-sm">
              <DetailRow label={m['settings.billing.plan']()}>
                {subscriptionTitle(viewing)}
              </DetailRow>
              <DetailRow label={m['settings.billing.status']()}>
                <Badge variant={statusVariant(viewing.status)}>
                  {statusLabel(viewing.status)}
                </Badge>
              </DetailRow>
              <DetailRow label={m['settings.billing.amount']()}>
                {viewing.amount && viewing.currency
                  ? `${formatAmount(viewing.amount, viewing.currency)}${
                      viewing.interval
                        ? ` / ${formatInterval(viewing.interval, viewing.intervalCount)}`
                        : ''
                    }`
                  : '—'}
              </DetailRow>
              <DetailRow label={m['settings.billing.provider']()}>
                {viewing.paymentProvider}
              </DetailRow>
              <DetailRow label={m['settings.billing.period_start']()}>
                {viewing.currentPeriodStart
                  ? new Date(viewing.currentPeriodStart).toLocaleString()
                  : '—'}
              </DetailRow>
              <DetailRow label={m['settings.billing.period_end']()}>
                {viewing.currentPeriodEnd
                  ? new Date(viewing.currentPeriodEnd).toLocaleString()
                  : '—'}
              </DetailRow>
              {viewing.canceledAt && (
                <DetailRow label={m['settings.billing.canceled_at']()}>
                  {new Date(viewing.canceledAt).toLocaleString()}
                </DetailRow>
              )}
              {viewing.canceledEndAt && (
                <DetailRow label={m['settings.billing.canceled_end_at']()}>
                  {new Date(viewing.canceledEndAt).toLocaleString()}
                </DetailRow>
              )}
              {viewing.canceledReason && (
                <DetailRow label={m['settings.billing.canceled_reason']()}>
                  {viewing.canceledReason}
                </DetailRow>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewing(null)}>
              {m['settings.billing.close']()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!canceling} onOpenChange={(v) => !v && setCanceling(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m['settings.billing.cancel_title']()}</DialogTitle>
            <DialogDescription>
              {m['settings.billing.cancel_description']({
                plan: canceling ? subscriptionTitle(canceling) : '—',
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCanceling(null)}
              disabled={submitting}
            >
              {m['settings.billing.cancel_back']()}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmCancel}
              disabled={submitting}
            >
              {submitting
                ? m['settings.billing.canceling']()
                : m['settings.billing.cancel_confirm']()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
