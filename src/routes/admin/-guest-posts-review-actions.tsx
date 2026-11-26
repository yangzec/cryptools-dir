import { Eye } from 'lucide-react';

import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { localizeHref } from '@/paraglide/runtime.js';
import { formatPrice } from '@/hooks/use-guest-posts';
import { Button, buttonVariants } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type Pkg = {
  planName: string;
  maxLinks: number;
  priceInCents: number;
  currency: string;
} | null;

export function ReviewActions({
  status,
  note,
  setNote,
  busy,
  dirty,
  restorable,
  pkg,
  postSlug,
  keepsEdits,
  confirm,
  onApprove,
  onRequestChanges,
  onReject,
  onUnpublish,
  onRepublish,
  onRestoreRequestChanges,
}: {
  status: string;
  note: string;
  setNote: (v: string) => void;
  busy: boolean;
  dirty: boolean;
  restorable: boolean;
  pkg: Pkg;
  postSlug: string;
  keepsEdits: () => Promise<boolean>;
  confirm: (opts: {
    title: string;
    description: string;
    confirmLabel?: string;
    destructive?: boolean;
  }) => Promise<boolean>;
  onApprove: () => void;
  onRequestChanges: () => void;
  onReject: () => void;
  onUnpublish: () => void;
  onRepublish: () => void;
  onRestoreRequestChanges: () => void;
}) {
  return (
    <div className="space-y-3 border-t pt-4">
      {(['submitted', 'changes_requested', 'published'].includes(status) ||
        restorable) && (
        <div className="space-y-2">
          <Label htmlFor="gp-note">{m['admin.guest_posts.note']()}</Label>
          <Textarea
            id="gp-note"
            value={note}
            rows={2}
            maxLength={2000}
            placeholder={m['admin.guest_posts.note_placeholder']()}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {status === 'submitted' && (
          <>
            <Button disabled={busy} onClick={onApprove}>
              {m['admin.guest_posts.approve']()}
            </Button>
            <Button
              variant="outline"
              disabled={busy || !note.trim()}
              onClick={async () => {
                if (await keepsEdits()) onRequestChanges();
              }}
            >
              {m['admin.guest_posts.request_changes']()}
            </Button>
          </>
        )}
        {(status === 'submitted' || status === 'changes_requested') && (
          <Button
            variant="outline"
            className="text-destructive"
            disabled={busy || !note.trim()}
            onClick={async () => {
              const price = pkg
                ? formatPrice(pkg.priceInCents, pkg.currency)
                : '';
              if (!(await keepsEdits())) return;
              if (
                await confirm({
                  title: m['admin.guest_posts.reject'](),
                  description: m['admin.guest_posts.reject_confirm']({
                    price,
                  }),
                  confirmLabel: m['admin.guest_posts.reject'](),
                  destructive: true,
                })
              )
                onReject();
            }}
          >
            {m['admin.guest_posts.reject']()}
          </Button>
        )}
        {status === 'published' && (
          <Button
            variant="outline"
            className="text-destructive"
            disabled={busy}
            onClick={async () => {
              if (!(await keepsEdits())) return;
              if (
                await confirm({
                  title: m['admin.guest_posts.unpublish'](),
                  description: m['admin.guest_posts.unpublish_confirm'](),
                  confirmLabel: m['admin.guest_posts.unpublish'](),
                  destructive: true,
                })
              )
                onUnpublish();
            }}
          >
            {m['admin.guest_posts.unpublish']()}
          </Button>
        )}
        {restorable && (
          <>
            <Button
              disabled={busy}
              onClick={async () => {
                if (
                  await confirm({
                    title: m['admin.guest_posts.republish'](),
                    description: m['admin.guest_posts.republish_confirm'](),
                    confirmLabel: m['admin.guest_posts.republish'](),
                  })
                )
                  onRepublish();
              }}
            >
              {m['admin.guest_posts.republish']()}
            </Button>
            <Button
              variant="outline"
              disabled={busy || !note.trim()}
              onClick={async () => {
                if (await keepsEdits()) onRestoreRequestChanges();
              }}
            >
              {m['admin.guest_posts.request_changes']()}
            </Button>
          </>
        )}
        {status !== 'published' && (
          // The preview renders the saved version, not pending edits.
          <a
            href={localizeHref(`/blog/${postSlug}?preview=1`)}
            target="_blank"
            rel="noopener"
            title={dirty ? m['admin.guest_posts.preview_unsaved']() : undefined}
            className={cn(
              buttonVariants({ variant: 'ghost' }),
              'ml-auto gap-1.5'
            )}
          >
            <Eye className="size-4" />
            {m['guest_posts.preview']()}
          </a>
        )}
      </div>
      {status === 'submitted' && (
        <p className="text-muted-foreground text-xs">
          {m['admin.guest_posts.review_hint']()}
        </p>
      )}
      {status === 'unpublished' && (
        <p className="text-muted-foreground text-xs">
          {restorable
            ? m['admin.guest_posts.restore_hint']()
            : m['admin.guest_posts.refunded_hint']()}
        </p>
      )}
    </div>
  );
}
