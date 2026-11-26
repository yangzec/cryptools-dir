import { m } from '@/paraglide/messages.js';
import { TextField } from '@/components/form-field';
import { RichTextEditor } from '@/components/rich-text-editor';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type { CategoryOption } from './-posts-shared';

export function renderPostFields(form: any, categoryOptions: CategoryOption[]) {
  return (
    <div className="space-y-4 py-4">
      <form.Field name="slug">
        {(field: any) => (
          <TextField
            field={field}
            label={m['admin.posts.slug_field']()}
            placeholder={m['admin.posts.slug_placeholder']()}
          />
        )}
      </form.Field>
      <form.Field name="title">
        {(field: any) => (
          <TextField
            field={field}
            label={m['admin.posts.title_field']()}
            placeholder={m['admin.posts.title_placeholder']()}
          />
        )}
      </form.Field>
      <form.Field name="description">
        {(field: any) => (
          <TextField
            field={field}
            label={m['admin.posts.description_field']()}
            placeholder={m['admin.posts.description_placeholder']()}
          />
        )}
      </form.Field>
      <form.Field name="authorName">
        {(field: any) => (
          <TextField
            field={field}
            label={m['admin.posts.author_field']()}
            placeholder={m['admin.posts.author_placeholder']()}
          />
        )}
      </form.Field>
      <form.Field name="categories">
        {(field: any) => (
          <div className="space-y-2">
            <Label>{m['admin.posts.category_field']()}</Label>
            <Select
              value={field.state.value || ''}
              onValueChange={(v) => field.handleChange(v || '')}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={m['admin.posts.category_placeholder']()}
                />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </form.Field>
      <form.Field name="status">
        {(field: any) => (
          <div className="space-y-2">
            <Label>{m['admin.posts.status_field']()}</Label>
            <Select
              value={field.state.value || 'draft'}
              onValueChange={(v) => field.handleChange(v || 'draft')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">
                  {m['admin.posts.status_draft']()}
                </SelectItem>
                <SelectItem value="published">
                  {m['admin.posts.status_published']()}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </form.Field>
      <form.Field name="content">
        {(field: any) => (
          <div className="space-y-2">
            <Label>{m['admin.posts.content_field']()}</Label>
            <RichTextEditor
              value={field.state.value}
              onChange={(content) => field.handleChange(content)}
              placeholder={m['admin.posts.content_placeholder']()}
            />
          </div>
        )}
      </form.Field>
    </div>
  );
}
