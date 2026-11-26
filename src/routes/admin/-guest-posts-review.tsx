import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

import { apiGet, apiPatch, apiPost, apiPut } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { localizeHref } from '@/paraglide/runtime.js';
import { useConfirm } from '@/hooks/use-confirm';
import {
  countExternalLinks,
  countWords,
  formatDate,
  formatPrice,
  type GuestPostRow,
  type GuestPostStatus,
} from '@/hooks/use-guest-posts';
import { DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UserCell } from '@/components/user-cell';

import { GuestPostStatusBadge } from '../settings/guest-posts/-shared';
import { ReviewActions } from './-guest-posts-review-actions';
import {
  ReviewDraftEditor,
  type ReviewDraft,
} from './-guest-posts-review-editor';
import { Meta } from './-guest-posts-review-meta';

interface AdminDetail {
  submission: GuestPostRow & { status: GuestPostStatus; userId: string };
  post: {
    slug: string;
    title: string | null;
    description: string | null;
    image: string | null;
    content: string | null;
  };
  userName: string | null;
  userEmail: string | null;
  userAvatar: string | null;
  orderStatus: string | null;
  package: {
    planName: string;
    maxLinks: number;
    priceInCents: number;
    currency: string;
  } | null;
}

function toDraft(post: AdminDetail['post']): ReviewDraft {
  return {
    title: post.title || '',
    slug: post.slug || '',
    description: post.description || '',
    image: post.image || '',
    content: post.content || '',
  };
}

// One view: the article is always editable, and the review actions save
// pending edits first (approve) or ask before dropping them (the rest).
export function ReviewPanel({
  id,
  onChanged,
  onDone,
}: {
  id: string;
  onChanged: () => void;
  onDone: () => void;
}) {
  const detail = useQuery({
    queryKey: ['admin-guest-post', id],
    queryFn: () => apiGet<AdminDetail>(`/api/admin/guest-posts/${id}`),
  });
  const [note, setNote] = useState('');
  const [draft, setDraft] = useState<ReviewDraft | null>(null);
  const { confirm, dialog } = useConfirm();

  // Seed the editor once the detail loads.
  const loadedPost = detail.data?.post;
  useEffect(() => {
    if (loadedPost && !draft) setDraft(toDraft(loadedPost));
  }, [loadedPost, draft]);

  const saved = loadedPost ? toDraft(loadedPost) : null;
  const dirty =
    !!draft &&
    !!saved &&
    (Object.keys(saved) as (keyof ReviewDraft)[]).some(
      (k) => draft[k] !== saved[k]
    );

  const save = () => apiPut(`/api/admin/guest-posts/${id}`, draft);

  const review = useMutation({
    mutationFn: async (action: 'approve' | 'request_changes') => {
      // Publish what the reviewer sees, edits included.
      if (action === 'approve' && dirty) await save();
      return apiPost(`/api/admin/guest-posts/${id}`, { action, note });
    },
    onSuccess: () => {
      toast.success(m['admin.guest_posts.reviewed_toast']());
      onChanged();
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  // Refunds the order (dedicated permission); the refund marks it rejected.
  const reject = useMutation({
    mutationFn: () => apiPost(`/api/admin/guest-posts/${id}/reject`, { note }),
    onSuccess: () => {
      toast.success(m['admin.guest_posts.rejected_toast']());
      onChanged();
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const restore = useMutation({
    mutationFn: async (action: 'republish' | 'request_changes') => {
      // Put back what the reviewer sees, edits included.
      if (action === 'republish' && dirty) await save();
      return apiPost(`/api/admin/guest-posts/${id}/restore`, { action, note });
    },
    onSuccess: () => {
      toast.success(m['admin.guest_posts.reviewed_toast']());
      onChanged();
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const unpublish = useMutation({
    mutationFn: () => apiPatch(`/api/admin/guest-posts/${id}`, { note }),
    onSuccess: () => {
      toast.success(m['admin.guest_posts.unpublished_toast']());
      onChanged();
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const saveEdit = useMutation({
    mutationFn: save,
    onSuccess: async () => {
      toast.success(m['admin.guest_posts.saved_toast']());
      onChanged();
      // Re-seed from the saved row (the server normalizes the slug).
      await detail.refetch();
      setDraft(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (detail.isError) {
    return <p className="text-muted-foreground">{detail.error.message}</p>;
  }
  if (detail.isPending || !draft) {
    return <p className="text-muted-foreground">{m['admin.loading']()}</p>;
  }
  const { submission: s, post, package: pkg } = detail.data;
  const links = countExternalLinks(draft.content);
  const busy =
    review.isPending ||
    reject.isPending ||
    unpublish.isPending ||
    restore.isPending ||
    saveEdit.isPending;
  // Taken down but still paid for: it can come back. A refund also takes a
  // published post down, and that one stays down.
  const restorable =
    s.status === 'unpublished' && detail.data.orderStatus === 'paid';
  const slugChanged =
    s.status === 'published' && draft.slug.trim().toLowerCase() !== post.slug;
  // Actions that don't publish leave edits unsaved; confirm dropping them.
  const keepsEdits = async () =>
    !dirty ||
    confirm({
      title: m['admin.guest_posts.unsaved_title'](),
      description: m['admin.guest_posts.unsaved_discard'](),
      confirmLabel: m['admin.guest_posts.discard_continue'](),
      destructive: true,
    });

  return (
    <div className="space-y-5">
      {dialog}
      <DialogHeader>
        <DialogTitle className="flex flex-wrap items-center gap-3 pr-6">
          {post.title || '—'}
          <GuestPostStatusBadge status={s.status} />
        </DialogTitle>
      </DialogHeader>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        <Meta label={m['admin.guest_posts.author_col']()}>
          <UserCell
            userId={s.userId}
            name={detail.data.userName}
            email={detail.data.userEmail}
            image={detail.data.userAvatar}
          />
        </Meta>
        <Meta label={m['admin.guest_posts.package']()}>
          {pkg
            ? `${pkg.planName} · ${formatPrice(pkg.priceInCents, pkg.currency)}`
            : s.productId}
        </Meta>
        <Meta label={m['admin.guest_posts.counts']()}>
          <span
            className={cn(pkg && links > pkg.maxLinks && 'text-destructive')}
          >
            {m['guest_posts.link_count']({
              count: links,
              max: pkg?.maxLinks ?? 0,
            })}
          </span>
          <span className="text-muted-foreground block text-xs">
            {m['admin.guest_posts.words']({
              count: countWords(draft.content),
            })}
          </span>
        </Meta>
        <Meta label={m['admin.guest_posts.submitted_at']()}>
          {formatDate(s.submittedAt)}
        </Meta>
        {s.orderNo && (
          <Meta label={m['admin.guest_posts.order']()}>
            <span className="font-mono text-xs">{s.orderNo}</span>
          </Meta>
        )}
      </dl>

      {s.status === 'published' && (
        <a
          href={localizeHref(`/blog/${post.slug}`)}
          target="_blank"
          rel="noopener"
          className="text-primary inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
        >
          {m['guest_posts.view_article']()}
          <ExternalLink className="size-3.5" />
        </a>
      )}

      {s.reviewNote && (
        <div className="bg-muted rounded-lg p-3 text-sm">
          <p className="font-medium">{m['guest_posts.review_note']()}</p>
          <p className="text-muted-foreground mt-1 whitespace-pre-line">
            {s.reviewNote}
          </p>
        </div>
      )}

      <ReviewDraftEditor
        draft={draft}
        setDraft={setDraft}
        slugChanged={slugChanged}
        dirty={dirty}
        busy={busy}
        onSave={async () => {
          if (
            slugChanged &&
            !(await confirm({
              title: m['admin.guest_posts.slug_change_title'](),
              description: m['admin.guest_posts.slug_change_confirm'](),
              destructive: true,
            }))
          )
            return;
          saveEdit.mutate();
        }}
        onDiscard={() => setDraft(toDraft(post))}
      />

      <ReviewActions
        status={s.status}
        note={note}
        setNote={setNote}
        busy={busy}
        dirty={dirty}
        restorable={restorable}
        pkg={pkg}
        postSlug={post.slug}
        keepsEdits={keepsEdits}
        confirm={confirm}
        onApprove={() => review.mutate('approve')}
        onRequestChanges={() => review.mutate('request_changes')}
        onReject={() => reject.mutate()}
        onUnpublish={() => unpublish.mutate()}
        onRepublish={() => restore.mutate('republish')}
        onRestoreRequestChanges={() => restore.mutate('request_changes')}
      />
    </div>
  );
}
