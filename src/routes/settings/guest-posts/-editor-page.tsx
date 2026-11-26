import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { ArrowLeft, Eye, Trash2, Zap } from 'lucide-react';
import { toast } from 'sonner';

import { Link, useRouter } from '@/core/i18n/navigation';
import { apiDelete, apiGet, apiPost, apiPut } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { localizeHref } from '@/paraglide/runtime.js';
import { useGuestPostCheckout } from '@/hooks/use-guest-post-checkout';
import {
  countExternalLinks,
  countWords,
  formatPrice,
  guestPostSubmitProblem,
  useGuestPostInfo,
  type GuestPostStatus,
} from '@/hooks/use-guest-posts';
import { MarkdownContent } from '@/components/markdown-content';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import { GuestPostEditorDialogs } from './-editor-dialogs';
import { GuestPostEditorForm } from './-editor-form';
import { StatusPanel } from './-editor-parts';
import { describeSubmitProblem, GuestPostStatusBadge } from './-shared';

const routeApi = getRouteApi('/settings/guest-posts/$id');

interface Detail {
  submission: {
    id: string;
    productId: string;
    status: GuestPostStatus;
    reviewNote: string | null;
  };
  post: {
    slug: string;
    title: string | null;
    description: string | null;
    image: string | null;
    content: string | null;
  };
}

export function GuestPostEditorPage() {
  const { id } = routeApi.useParams();
  // Package picked on /guest-post, preselected for a new article.
  const { package: requestedPackage } = routeApi.useSearch();
  const isNew = id === 'new';
  const router = useRouter();
  const queryClient = useQueryClient();
  const info = useGuestPostInfo();

  const detail = useQuery({
    queryKey: ['guest-post', id],
    queryFn: () => apiGet<Detail>(`/api/guest-posts/${id}`),
    enabled: !isNew,
  });

  const [productId, setProductId] = useState('');
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');
  const [content, setContent] = useState('');
  const [loaded, setLoaded] = useState(isNew);

  // Fill the form once from the server copy.
  useEffect(() => {
    if (!detail.data || loaded) return;
    const { submission, post } = detail.data;
    setProductId(submission.productId);
    setTitle(post.title || '');
    setSlug(post.slug || '');
    setDescription(post.description || '');
    setImage(post.image || '');
    setContent(post.content || '');
    setLoaded(true);
  }, [detail.data, loaded]);

  const packages = info.data?.packages ?? [];
  useEffect(() => {
    if (productId || !packages.length) return;
    const requested = packages.find((p) => p.productId === requestedPackage);
    setProductId((requested ?? packages[0]).productId);
  }, [packages, productId, requestedPackage]);
  const pkg = packages.find((p) => p.productId === productId);
  const price = pkg ? formatPrice(pkg.priceInCents, pkg.currency) : '';

  const submission = detail.data?.submission;
  const status: GuestPostStatus = submission?.status ?? 'draft';
  const isDraft = isNew || status === 'draft';
  const editable = isDraft || status === 'changes_requested';

  const words = useMemo(() => countWords(content), [content]);
  const links = useMemo(() => countExternalLinks(content), [content]);
  const minWords = info.data?.minWords ?? 0;

  const refresh = (savedId: string) => {
    queryClient.invalidateQueries({ queryKey: ['guest-posts'] });
    queryClient.invalidateQueries({ queryKey: ['guest-post', savedId] });
  };

  /** Save the form; returns the submission id (creates it when new). */
  async function saveForm(resubmit = false) {
    const body = {
      productId,
      title,
      slug,
      description,
      image,
      content,
      resubmit,
    };
    if (isNew) {
      const res = await apiPost<{ id: string }>('/api/guest-posts', body);
      return res.id;
    }
    await apiPut(`/api/guest-posts/${id}`, body);
    return id;
  }

  const save = useMutation({
    mutationFn: (resubmit: boolean) => saveForm(resubmit),
    onSuccess: (savedId, resubmit) => {
      toast.success(
        resubmit
          ? m['guest_posts.resubmitted_toast']()
          : m['guest_posts.saved_toast']()
      );
      refresh(savedId);
      // Saved (or resubmitted): back to the list.
      router.replace('/settings/guest-posts');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const remove = useMutation({
    mutationFn: () => apiDelete(`/api/guest-posts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-posts'] });
      router.replace('/settings/guest-posts');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Submit = save, then pay (the webhook moves the paid draft into review).
  // A new article is saved first; if checkout then fails, open that draft so
  // a retry doesn't create a second one.
  const createdId = useRef<string | null>(null);
  const checkout = useGuestPostCheckout({
    resolveId: async () => {
      const savedId = createdId.current ?? (await saveForm(false));
      if (isNew) {
        createdId.current = savedId;
        refresh(savedId);
      }
      return savedId;
    },
    onError: (e) => {
      toast.error(e.message);
      if (isNew && createdId.current)
        router.replace(`/settings/guest-posts/${createdId.current}`);
    },
  });

  if (!isNew && (detail.isPending || !loaded)) {
    return (
      <div className="text-muted-foreground p-6">
        {m['guest_posts.loading']()}
      </div>
    );
  }
  if (!isNew && detail.isError) {
    return (
      <div className="text-muted-foreground p-6">{detail.error.message}</div>
    );
  }

  const busy = save.isPending || checkout.pending || remove.isPending;

  /** Check first (a failed submit saves nothing), then save and pay. */
  function submitAndPay() {
    const problem = guestPostSubmitProblem({
      title,
      content,
      minWords,
      maxLinks: pkg?.maxLinks ?? 0,
    });
    if (problem) toast.error(describeSubmitProblem(problem));
    else checkout.pay();
  }
  // The saved slug (previews and links use it, not the field being edited).
  const savedSlug = detail.data?.post.slug;

  return (
    <div className="space-y-6 p-6 lg:max-w-4xl">
      <div className="space-y-3">
        <Link
          href="/settings/guest-posts"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" />
          {m['guest_posts.back']()}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">
            {isNew
              ? m['guest_posts.new_title']()
              : m['guest_posts.edit_title']()}
          </h1>
          {!isNew && <GuestPostStatusBadge status={status} />}
          <div className="ml-auto flex items-center gap-2">
            {isDraft && pkg && (
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                disabled={busy}
                onClick={submitAndPay}
              >
                <Zap className="size-3.5" />
                {m['guest_posts.pay_submit']({ price })}
              </Button>
            )}
            {!isNew && savedSlug && status !== 'published' && (
              <a
                href={localizeHref(`/blog/${savedSlug}?preview=1`)}
                target="_blank"
                rel="noopener"
                title={
                  editable ? m['guest_posts.preview_saved_hint']() : undefined
                }
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'sm' }),
                  'gap-1.5'
                )}
              >
                <Eye className="size-3.5" />
                {m['guest_posts.preview']()}
              </a>
            )}
            {/* Only unpaid drafts can be deleted. */}
            {!isNew && status === 'draft' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive gap-1.5"
                disabled={busy}
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="size-3.5" />
                {m['guest_posts.delete']()}
              </Button>
            )}
          </div>
        </div>
      </div>

      {!isNew && (
        <StatusPanel
          status={status}
          note={submission?.reviewNote}
          slug={savedSlug}
        />
      )}

      {editable ? (
        <GuestPostEditorForm
          isDraft={isDraft}
          packages={packages}
          pkg={pkg}
          productId={productId}
          setProductId={setProductId}
          title={title}
          setTitle={setTitle}
          slug={slug}
          setSlug={setSlug}
          description={description}
          setDescription={setDescription}
          image={image}
          setImage={setImage}
          content={content}
          setContent={setContent}
          words={words}
          links={links}
          minWords={minWords}
          busy={busy}
          price={price}
          onSubmitPay={submitAndPay}
          onSaveDraft={() => save.mutate(false)}
          onResubmit={() => save.mutate(true)}
        />
      ) : (
        <Card>
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold">{title}</h2>
            {description && (
              <p className="text-muted-foreground">{description}</p>
            )}
            {image && <img src={image} alt="" className="rounded-xl border" />}
            <MarkdownContent content={content} sponsored />
          </CardContent>
        </Card>
      )}

      <GuestPostEditorDialogs
        deleteOpen={deleteOpen}
        setDeleteOpen={setDeleteOpen}
        title={title}
        removePending={remove.isPending}
        onDelete={() => remove.mutate()}
        checkoutPickerProps={checkout.pickerProps}
        planName={pkg?.planName}
        price={price}
      />
    </div>
  );
}
