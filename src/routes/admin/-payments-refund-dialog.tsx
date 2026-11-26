import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiPost } from '@/lib/api-client';
import { m } from '@/paraglide/messages.js';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import type { Order } from './-payments-edit-dialog';

interface RefundResult {
  refundStatus: string;
  creditsDeducted: number;
  creditsRequested: number;
  subscriptionError?: string;
}

function formatAmount(amount: number, currency: string) {
  const value = amount / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(value);
}

export function RefundOrderDialog({
  order,
  onClose,
}: {
  order: Order | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [refundCredits, setRefundCredits] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundCancelSub, setRefundCancelSub] = useState(true);

  useEffect(() => {
    if (order) {
      setRefundCredits(String(order.creditsAmount ?? 0));
      setRefundReason('');
      setRefundCancelSub(true);
    }
  }, [order]);

  const refundMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiPost<RefundResult>('/api/admin/orders/refund', body),
    onSuccess: (result) => {
      toast.success(
        result.refundStatus === 'pending'
          ? m['admin.payments.refund_pending']({
              credits: result.creditsDeducted,
            })
          : m['admin.payments.refund_success']({
              credits: result.creditsDeducted,
            })
      );
      if (result.creditsDeducted < result.creditsRequested) {
        toast.warning(
          m['admin.payments.refund_credits_short']({
            deducted: result.creditsDeducted,
            requested: result.creditsRequested,
          })
        );
      }
      if (result.subscriptionError) {
        toast.error(
          m['admin.payments.refund_cancel_failed']({
            error: result.subscriptionError,
          })
        );
      }
      onClose();
      queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
    },
  });

  function submitRefund() {
    if (!order) return;
    const credits = Number(refundCredits);
    if (!Number.isInteger(credits) || credits < 0) {
      toast.error(m['admin.payments.refund_credits_invalid']());
      return;
    }
    refundMutation.mutate({
      orderNo: order.orderNo,
      deductCredits: credits,
      reason: refundReason.trim() || undefined,
      cancelSubscription: !!order.subscriptionNo && refundCancelSub,
    });
  }

  return (
    <Dialog
      open={!!order}
      onOpenChange={(open) => {
        if (!open && !refundMutation.isPending) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m['admin.payments.refund_title']()}</DialogTitle>
          <DialogDescription>
            {m['admin.payments.refund_description']({
              provider: order?.paymentProvider || '',
            })}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            submitRefund();
          }}
        >
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <div className="text-muted-foreground">
                  {m['admin.payments.order_no']()}
                </div>
                <div className="font-mono text-xs break-all">
                  {order?.orderNo}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">
                  {m['admin.payments.refund_amount']()}
                </div>
                <div className="font-medium">
                  {order &&
                    formatAmount(
                      order.paymentAmount ?? order.amount,
                      order.currency
                    )}
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="refund-credits">
                {m['admin.payments.refund_credits_label']()}
              </Label>
              <Input
                id="refund-credits"
                type="number"
                min={0}
                step={1}
                value={refundCredits}
                onChange={(event) => setRefundCredits(event.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                {m['admin.payments.refund_credits_hint']({
                  credits: order?.creditsAmount ?? 0,
                })}
              </p>
            </div>
            {order?.subscriptionNo && (
              <label className="flex cursor-pointer items-center gap-3 text-sm">
                <Checkbox
                  checked={refundCancelSub}
                  onCheckedChange={(checked) =>
                    setRefundCancelSub(checked === true)
                  }
                />
                {m['admin.payments.refund_cancel_subscription']()}
              </label>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="refund-reason">
                {m['admin.payments.refund_reason_label']()}
              </Label>
              <Input
                id="refund-reason"
                value={refundReason}
                maxLength={500}
                onChange={(event) => setRefundReason(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={refundMutation.isPending}
              onClick={onClose}
            >
              {m['admin.payments.cancel']()}
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={refundMutation.isPending}
            >
              {refundMutation.isPending
                ? m['admin.payments.refunding']()
                : m['admin.payments.refund_confirm']()}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
