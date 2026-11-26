import { useEffect } from 'react';
import { useForm } from '@tanstack/react-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { tDynamic } from '@/core/i18n/dynamic';
import { apiPatch } from '@/lib/api-client';
import { m } from '@/paraglide/messages.js';
import { Button } from '@/components/ui/button';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface Order {
  id: string;
  orderNo: string;
  userId: string;
  userEmail: string | null;
  status: string;
  amount: number;
  currency: string;
  paymentType: string | null;
  paymentProvider: string;
  productId: string | null;
  productName: string | null;
  description: string | null;
  createdAt: string;
  paidAt: string | null;
  paymentAmount: number | null;
  creditsAmount: number | null;
  subscriptionNo: string | null;
  refundAmount: number | null;
  refundedAt: string | null;
  userName: string | null;
  userImage: string | null;
  userAccountEmail: string | null;
}

export function EditOrderDialog({
  order,
  onClose,
}: {
  order: Order | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const editMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiPatch('/api/admin/orders', body),
    onSuccess: () => {
      toast.success(m['admin.payments.update_success']());
      onClose();
      queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editForm = useForm({
    defaultValues: {
      status: '',
      productId: '',
      productName: '',
      description: '',
    },
    onSubmit: async ({ value }) => {
      if (!order) return;
      await editMutation.mutateAsync({
        orderNo: order.orderNo,
        status: value.status,
        productId: value.productId || null,
        productName: value.productName || null,
        description: value.description || null,
      });
    },
  });

  useEffect(() => {
    if (order) {
      editForm.reset({
        status: order.status,
        productId: order.productId || '',
        productName: order.productName || '',
        description: order.description || '',
      });
    }
  }, [order]);

  return (
    <Dialog
      open={!!order}
      onOpenChange={(open) => {
        if (!open && !editMutation.isPending) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m['admin.payments.edit_title']()}</DialogTitle>
          <DialogDescription>
            {m['admin.payments.edit_description']()}
          </DialogDescription>
        </DialogHeader>
        <form
          key={order?.orderNo ?? 'edit'}
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            editForm.handleSubmit();
          }}
        >
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{m['admin.payments.order_no']()}</Label>
              <Input value={order?.orderNo || ''} disabled />
            </div>
            <editForm.Field name="status">
              {(field) => (
                <div className="space-y-1.5">
                  <Label>{m['admin.payments.status_label']()}</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(value) => field.handleChange(value || '')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Only an unpaid order can be closed by hand; payment
                          states change through checkout and refunds. */}
                      {[
                        order?.status || '',
                        ...(['created', 'pending'].includes(order?.status || '')
                          ? ['failed']
                          : []),
                      ]
                        .filter(Boolean)
                        .map((status) => (
                          <SelectItem key={status} value={status}>
                            {tDynamic(`admin.payments.status_${status}`)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </editForm.Field>
            {(['productId', 'productName', 'description'] as const).map(
              (name) => (
                <editForm.Field key={name} name={name}>
                  {(field) => (
                    <div className="space-y-1.5">
                      <Label>
                        {m[
                          `admin.payments.${
                            name === 'productId'
                              ? 'product_id_label'
                              : name === 'productName'
                                ? 'product_name_label'
                                : 'product_description_label'
                          }`
                        ]()}
                      </Label>
                      <Input
                        value={field.state.value}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                      />
                    </div>
                  )}
                </editForm.Field>
              )
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={editMutation.isPending}
              onClick={onClose}
            >
              {m['admin.payments.cancel']()}
            </Button>
            <Button type="submit" disabled={editMutation.isPending}>
              {editMutation.isPending
                ? m['admin.payments.saving']()
                : m['admin.payments.save']()}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
