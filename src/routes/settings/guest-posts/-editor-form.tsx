import { Info } from 'lucide-react';

import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { localizeHref } from '@/paraglide/runtime.js';
import type { GuestPostPackage } from '@/hooks/use-guest-posts';
import {
  ImageUploader,
  type ImageUploaderValue,
} from '@/components/image-uploader';
import { RichTextEditor } from '@/components/rich-text-editor';
import { SlugInput } from '@/components/slug-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { PackageOption } from './-editor-parts';

export function GuestPostEditorForm(props: {
  isDraft: boolean;
  packages: GuestPostPackage[];
  pkg: GuestPostPackage | undefined;
  productId: string;
  setProductId: (v: string) => void;
  title: string;
  setTitle: (v: string) => void;
  slug: string;
  setSlug: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  image: string;
  setImage: (v: string) => void;
  content: string;
  setContent: (v: string) => void;
  words: number;
  links: number;
  minWords: number;
  busy: boolean;
  price: string;
  onSubmitPay: () => void;
  onSaveDraft: () => void;
  onResubmit: () => void;
}) {
  const {
    isDraft,
    packages,
    pkg,
    productId,
    setProductId,
    title,
    setTitle,
    slug,
    setSlug,
    description,
    setDescription,
    image,
    setImage,
    content,
    setContent,
    words,
    links,
    minWords,
    busy,
    price,
    onSubmitPay,
    onSaveDraft,
    onResubmit,
  } = props;
  return (
    <form
      className="min-w-0 space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (isDraft) onSubmitPay();
        else onResubmit();
      }}
    >
      <div className="space-y-2">
        <Label>{m['guest_posts.package']()}</Label>
        <div className="grid gap-3 sm:grid-cols-2">
          {(isDraft ? packages : packages.filter((p) => p === pkg)).map((p) => (
            <PackageOption
              key={p.productId}
              pkg={p}
              selected={p.productId === productId}
              disabled={!isDraft}
              onSelect={() => setProductId(p.productId)}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="gp-title">{m['guest_posts.field_title']()}</Label>
        <Input
          id="gp-title"
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="gp-slug">{m['guest_posts.field_slug']()}</Label>
        <SlugInput
          id="gp-slug"
          prefix="/blog/"
          value={slug}
          placeholder={m['guest_posts.slug_placeholder']()}
          onChange={setSlug}
        />
        <p className="text-muted-foreground text-xs">
          {m['guest_posts.slug_hint']()}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="gp-summary">{m['guest_posts.field_summary']()}</Label>
        <Textarea
          id="gp-summary"
          value={description}
          maxLength={500}
          rows={2}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>{m['guest_posts.field_cover']()}</Label>
        <ImageUploader
          maxSizeMB={5}
          defaultPreviews={image ? [image] : undefined}
          onChange={(items: ImageUploaderValue[]) => {
            const done = items.find((i) => i.status === 'uploaded' && i.url);
            setImage(done?.url || (items.length ? image : ''));
          }}
        />
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <Label>{m['guest_posts.field_content']()}</Label>
          <span className="text-muted-foreground text-xs">
            <span className={cn(words < minWords && 'text-destructive')}>
              {m['guest_posts.word_count']({
                count: words,
                min: minWords,
              })}
            </span>
            {' · '}
            <span
              className={cn(pkg && links > pkg.maxLinks && 'text-destructive')}
            >
              {m['guest_posts.link_count']({
                count: links,
                max: pkg?.maxLinks ?? 0,
              })}
            </span>
          </span>
        </div>
        <RichTextEditor
          value={content}
          onChange={setContent}
          placeholder={m['guest_posts.content_placeholder']()}
        />
        <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {m['guest_posts.sponsored_notice']()}{' '}
            {/* New tab, so the article being edited isn't lost. */}
            <a
              href={localizeHref('/guest-post')}
              target="_blank"
              rel="noopener"
              className="text-primary font-medium underline-offset-4 hover:underline"
            >
              {m['guest_posts.guidelines_link']()}
            </a>
          </span>
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy || !pkg}>
            {isDraft
              ? m['guest_posts.pay_submit']({ price })
              : m['guest_posts.resubmit']()}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy || !pkg}
            onClick={onSaveDraft}
          >
            {m['guest_posts.save_draft']()}
          </Button>
        </div>
        {isDraft && (
          <p className="text-muted-foreground text-xs">
            {m['guest_posts.pay_notice']()}
          </p>
        )}
      </div>
    </form>
  );
}
