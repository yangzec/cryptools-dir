import { createFileRoute, notFound } from '@tanstack/react-router';
import { describeSubmitProblem } from '@/routes/settings/guest-posts/-shared';
import { MDXProvider } from '@mdx-js/react';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Eye,
  Pencil,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

import { Link, useRouter } from '@/core/i18n/navigation';
import { envConfigs } from '@/config';
import { withDirectoryBrand } from '@/lib/directory/page-title';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { getLocale, localizeUrl } from '@/paraglide/runtime.js';
import { useGuestPostCheckout } from '@/hooks/use-guest-post-checkout';
import { formatPrice, guestPostSubmitProblem } from '@/hooks/use-guest-posts';
import { DirectoryLayout } from '@/components/directory/DirectoryLayout';
import { SponsorAdsSlot } from '@/components/directory/SponsorAdsSlot';
import { MarkdownContent } from '@/components/markdown-content';
import { mdxComponents } from '@/components/mdx-components';
import { PaymentProviderModal } from '@/components/payment-provider-modal';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  formatPostDate,
  loadLocalPost,
  type BlogPostDetail,
} from '@/content/posts';
import {
  getBlogPostFn,
  getBlogPostsFn,
  getBlogPreviewFn,
} from '@/content/posts/server';

export const Route = createFileRoute('/blog/$slug')({
  // ?preview=1: an unpublished guest post, for its author or a reviewer.
  validateSearch: (search: Record<string, unknown>): { preview?: boolean } =>
    search.preview === 1 || search.preview === '1' || search.preview === true
      ? { preview: true }
      : {},
  loaderDeps: ({ search }) => ({ preview: !!search.preview }),
  loader: async ({ params, deps }) => {
    const locale = getLocale();
    const [post, allPosts] = await Promise.all([
      (deps.preview
        ? await getBlogPreviewFn({ data: { slug: params.slug } })
        : null) ??
        (await getBlogPostFn({ data: { slug: params.slug, locale } })),
      getBlogPostsFn({ data: { locale, limit: 6 } }),
    ]);
    if (!post) throw notFound();
    const recommendedPosts = allPosts.filter((p) => p.slug !== params.slug);
    return { locale, post, recommendedPosts };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { locale, post } = loaderData;
    if (post.preview) {
      return {
        meta: [
          { title: withDirectoryBrand(locale, post.title) },
          { name: 'robots', content: 'noindex, nofollow' },
        ],
      };
    }
    const canonical = localizeUrl(`${envConfigs.app_url}/blog/${post.slug}`, {
      locale: locale as any,
    }).href;
    return {
      meta: [
        { title: withDirectoryBrand(locale, post.title) },
        { name: 'description', content: post.description },
      ],
      links: [{ rel: 'canonical', href: canonical }],
    };
  },
  component: BlogPostPage,
});

/**
 * Preview of an unpublished guest post. The author gets their next step
 * (pay to submit, or edit when changes were requested); reviewers a note.
 */
function PreviewBanner({
  info,
  title,
  content,
}: {
  info?: NonNullable<BlogPostDetail['previewInfo']>;
  title: string;
  content: string;
}) {
  const router = useRouter();
  const editHref = info ? `/settings/guest-posts/${info.guestPostId}` : '';
  const price = info ? formatPrice(info.priceInCents, info.currency) : '';
  // Straight to the payment page; if the article can't be submitted yet
  // (too short, too many links), offer the editor.
  const checkout = useGuestPostCheckout({
    resolveId: async () => info!.guestPostId,
    onError: (e) =>
      toast.error(e.message, {
        action: {
          label: m['blog.preview_edit'](),
          onClick: () => router.push(editHref),
        },
      }),
  });
  let text = m['blog.preview_banner']();
  let action: React.ReactNode = null;
  if (info?.isAuthor) {
    if (info.status === 'draft') {
      text = m['blog.preview_draft']();
      action = (
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={editHref}
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'gap-1.5'
            )}
          >
            <Pencil className="size-3.5" />
            {m['blog.preview_edit']()}
          </Link>
          <Button
            size="sm"
            className="shrink-0 gap-1.5"
            disabled={checkout.pending}
            onClick={() => {
              const problem = guestPostSubmitProblem({
                title,
                content,
                minWords: info.minWords,
                maxLinks: info.maxLinks,
              });
              if (!problem) return checkout.pay();
              toast.error(describeSubmitProblem(problem), {
                action: {
                  label: m['blog.preview_edit'](),
                  onClick: () => router.push(editHref),
                },
              });
            }}
          >
            <Zap className="size-3.5" />
            {m['guest_posts.pay_submit']({ price })}
          </Button>
        </div>
      );
    } else if (info.status === 'changes_requested') {
      text = m['guest_posts.changes_hint']();
      action = (
        <Link
          href={editHref}
          className={cn(buttonVariants({ size: 'sm' }), 'shrink-0')}
        >
          {m['blog.preview_edit']()}
        </Link>
      );
    } else if (info.status === 'submitted') {
      text = m['blog.preview_submitted']();
    } else if (info.status === 'rejected') {
      text = m['guest_posts.rejected_hint']();
    } else if (info.status === 'unpublished') {
      text = m['guest_posts.unpublished_hint']();
    }
  }
  // Nothing to do here: a way back (the author's list, or the review dialog).
  if (info && !action) {
    action = (
      <Link
        href={
          info.isAuthor
            ? '/settings/guest-posts'
            : `/admin/guest-posts?id=${info.guestPostId}`
        }
        className={cn(
          buttonVariants({ variant: 'outline', size: 'sm' }),
          'shrink-0 gap-1.5'
        )}
      >
        {info.isAuthor
          ? m['blog.preview_my_posts']()
          : m['blog.preview_back_review']()}
        <ArrowRight className="size-3.5" />
      </Link>
    );
  }
  return (
    <div className="mx-auto mb-8 flex max-w-3xl flex-wrap items-center gap-3 rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
      <Eye className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">{text}</span>
      {action}
      <PaymentProviderModal {...checkout.pickerProps} price={price} />
    </div>
  );
}

function siteHost() {
  try {
    return new URL(envConfigs.app_url).hostname;
  } catch {
    return envConfigs.app_name;
  }
}

function BlogPostPage() {
  const { locale, post, recommendedPosts } = Route.useLoaderData();

  // Local posts render their bundled MDX component; database posts render
  // raw markdown through MarkdownContent.
  const LocalContent =
    post.source === 'local' ? loadLocalPost(post.slug, locale)?.default : null;

  return (
    <DirectoryLayout>
      {post.preview && (
        <PreviewBanner
          info={post.previewInfo}
          title={post.title}
          content={post.content || ''}
        />
      )}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <article className="min-w-0">
          <Link
            href="/blog"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm font-medium transition-colors"
          >
            <ArrowLeft className="size-4" />
            {m['blog.back_to_blog']()}
          </Link>

          <header className="border-border mt-8 mb-6 border-b pb-6">
            {post.sponsored && (
              <span className="text-muted-foreground border-border mb-3 inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide uppercase">
                {m['blog.sponsored']()}
              </span>
            )}
            <h1 className="text-foreground text-3xl font-semibold tracking-tight md:text-4xl">
              {post.title}
            </h1>
            <div className="text-muted-foreground mt-4 flex flex-wrap items-center gap-4 text-sm">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="size-4" />
                {formatPostDate(post.createdAt, locale)}
              </span>
              {(post.authorName || post.authorImage) && (
                <span className="inline-flex items-center gap-2">
                  {post.authorImage && (
                    <img
                      src={post.authorImage}
                      alt={post.authorName || ''}
                      width={20}
                      height={20}
                      className="size-5 rounded-full object-cover"
                    />
                  )}
                  {post.authorName}
                </span>
              )}
            </div>
          </header>

          {post.description && (
            <p className="text-muted-foreground mb-6">{post.description}</p>
          )}

          {post.image && (
            <img
              src={post.image}
              alt={post.title}
              className="border-border mb-8 w-full rounded-2xl border object-cover"
            />
          )}

          {LocalContent ? (
            <div className="text-foreground/90 text-[15px] leading-7">
              <MDXProvider components={mdxComponents}>
                <LocalContent />
              </MDXProvider>
            </div>
          ) : (
            <MarkdownContent
              content={post.content || ''}
              sponsored={post.sponsored}
              // Guest posts: show the linked sites where their traffic
              // came from (utm_source = this site).
              utm={
                post.sponsored
                  ? { source: siteHost(), medium: 'guest_post' }
                  : undefined
              }
            />
          )}
        </article>

        <aside className="space-y-3 self-start lg:sticky lg:top-[calc(var(--header-h,3.5rem)+1.5rem+var(--banner-h))] lg:pt-2">
          <SponsorAdsSlot placement="listing" limit={4} />

          {recommendedPosts.length > 0 && (
            <section className="pt-6">
              <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-[0.18em] uppercase">
                {m['blog.recommended_reading']()}
              </p>
              <ul className="space-y-2">
                {recommendedPosts.map((rec) => (
                  <li key={rec.slug}>
                    <Link
                      href={`/blog/${rec.slug}`}
                      className="border-border bg-card hover:border-primary/35 block rounded-xl border px-3 py-2.5 transition"
                    >
                      <p className="line-clamp-2 text-sm font-semibold">
                        {rec.title}
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {formatPostDate(rec.createdAt, locale)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </DirectoryLayout>
  );
}
