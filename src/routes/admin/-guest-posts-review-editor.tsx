import type { Dispatch, SetStateAction } from 'react';

import { m } from '@/paraglide/messages.js';
import { RichTextEditor } from '@/components/rich-text-editor';
import { SlugInput } from '@/components/slug-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export type ReviewDraft = {
  title: string;
  slug: string;
  description: string;
  image: string;
  content: string;
};

export function ReviewDraftEditor({
  draft,
  setDraft,
  slugChanged,
  dirty,
  busy,
  onSave,
  onDiscard,
}: {
  draft: ReviewDraft;
  setDraft: Dispatch<SetStateAction<ReviewDraft | null>>;
  slugChanged: boolean;
  dirty: boolean;
  busy: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{m['guest_posts.field_title']()}</Label>
        <Input
          value={draft.title}
          maxLength={200}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="gp-admin-slug">{m['guest_posts.field_slug']()}</Label>
        <SlugInput
          id="gp-admin-slug"
          prefix="/blog/"
          value={draft.slug}
          placeholder={m['guest_posts.slug_placeholder']()}
          onChange={(slug) => setDraft((d) => d && { ...d, slug })}
        />
        {slugChanged ? (
          <p className="text-destructive text-xs">
            {m['admin.guest_posts.slug_change_warning']()}
          </p>
        ) : (
          <p className="text-muted-foreground text-xs">
            {m['admin.guest_posts.slug_hint']()}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label>{m['guest_posts.field_summary']()}</Label>
        <Textarea
          value={draft.description}
          rows={2}
          maxLength={500}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>{m['guest_posts.field_content']()}</Label>
        <RichTextEditor
          value={draft.content}
          onChange={(c) => setDraft((d) => d && { ...d, content: c })}
        />
      </div>
      {dirty && (
        <div className="flex items-center gap-2">
          <Button disabled={busy} onClick={onSave}>
            {m['admin.guest_posts.save']()}
          </Button>
          <Button variant="outline" disabled={busy} onClick={onDiscard}>
            {m['admin.guest_posts.discard']()}
          </Button>
          <span className="text-muted-foreground text-xs">
            {m['admin.guest_posts.unsaved']()}
          </span>
        </div>
      )}
    </div>
  );
}
