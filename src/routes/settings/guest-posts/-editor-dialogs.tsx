import { m } from '@/paraglide/messages.js';
import { PaymentProviderModal } from '@/components/payment-provider-modal';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function GuestPostEditorDialogs({
  deleteOpen,
  setDeleteOpen,
  title,
  removePending,
  onDelete,
  checkoutPickerProps,
  planName,
  price,
}: {
  deleteOpen: boolean;
  setDeleteOpen: (v: boolean) => void;
  title: string;
  removePending: boolean;
  onDelete: () => void;
  checkoutPickerProps: any;
  planName?: string;
  price: string;
}) {
  return (
    <>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m['guest_posts.delete_title']()}</DialogTitle>
            <DialogDescription>
              {m['guest_posts.delete_confirm']({ title: title || '—' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              {m['guest_posts.cancel']()}
            </Button>
            <Button
              variant="destructive"
              disabled={removePending}
              onClick={onDelete}
            >
              {m['guest_posts.delete']()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PaymentProviderModal
        {...checkoutPickerProps}
        planName={planName}
        price={price}
      />
    </>
  );
}
