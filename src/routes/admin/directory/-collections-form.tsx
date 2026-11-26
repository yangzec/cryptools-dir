import { z } from 'zod';

import { tDynamic } from '@/core/i18n/dynamic';
import { m } from '@/paraglide/messages.js';
import { TextField } from '@/components/form-field';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  DirectoryFormRow,
  DirectoryImageField,
  DirectoryLocaleSection,
  localeField,
} from './-form-ui';

export interface DirCollection {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  nameZh: string;
  descriptionZh: string;
  icon: string | null;
  coverUrl: string | null;
  sort: number;
  status: string;
  toolCount: number;
  toolIds: string[];
  createdAt: string;
}

export interface ToolOption {
  id: string;
  slug: string;
  name: string;
}

export const PAGE_SIZE = 20;
export const schema = z.object({
  slug: z.string(),
  name: z.string().min(1),
  description: z.string(),
  nameZh: z.string(),
  descriptionZh: z.string(),
  icon: z.string(),
  coverUrl: z.string(),
  sort: z.string(),
  status: z.string(),
});
export type FormValues = z.infer<typeof schema>;
export const emptyForm: FormValues = {
  slug: '',
  name: '',
  description: '',
  nameZh: '',
  descriptionZh: '',
  icon: '',
  coverUrl: '',
  sort: '0',
  status: 'published',
};

export function valuesFromCollection(row: DirCollection): FormValues {
  return {
    slug: row.slug || '',
    name: row.name || '',
    description: row.description || '',
    nameZh: row.nameZh || '',
    descriptionZh: row.descriptionZh || '',
    icon: row.icon || '',
    coverUrl: row.coverUrl || '',
    sort: String(row.sort ?? 0),
    status: row.status === 'draft' ? 'draft' : 'published',
  };
}

export function toPayload(value: FormValues) {
  return {
    slug: value.slug.trim() || undefined,
    name: value.name.trim(),
    // Always send (incl. '') so clearing EN/ZH copy reaches the API.
    description: value.description.trim(),
    nameZh: value.nameZh.trim(),
    descriptionZh: value.descriptionZh.trim(),
    icon: value.icon.trim(),
    coverUrl: value.coverUrl.trim(),
    sort: Number(value.sort) || 0,
    status: value.status === 'draft' ? 'draft' : 'published',
  };
}

/** Edit omits slug — public collection URLs stay stable after create. */
export function toEditPayload(value: FormValues) {
  const { slug: _slug, ...rest } = toPayload(value);
  return rest;
}

export function renderCollectionFields(
  form: any,
  opts?: { lockSlug?: boolean }
) {
  const lockSlug = Boolean(opts?.lockSlug);
  return (
    <div className="space-y-4">
      <form.Field name="slug">
        {(field: any) => (
          <TextField
            field={field}
            label={m['admin.directory.common.slug']()}
            placeholder="best-coding-agents"
            disabled={lockSlug}
          />
        )}
      </form.Field>
      {lockSlug ? (
        <p className="text-muted-foreground text-xs">
          {m['admin.directory.common.slug_locked_hint']()}
        </p>
      ) : null}

      <DirectoryLocaleSection>
        {(locale) => (
          <>
            <form.Field name={localeField('name', locale)}>
              {(field: any) => (
                <TextField
                  field={field}
                  label={m['admin.directory.common.name']()}
                  placeholder={
                    locale === 'en'
                      ? 'Best Coding Agents'
                      : m['admin.directory.common.name_zh_placeholder']()
                  }
                />
              )}
            </form.Field>
            <form.Field name={localeField('description', locale)}>
              {(field: any) => (
                <TextField
                  field={field}
                  label={m['admin.directory.common.description']()}
                />
              )}
            </form.Field>
          </>
        )}
      </DirectoryLocaleSection>

      <DirectoryFormRow>
        <form.Field name="icon">
          {(field: any) => (
            <TextField
              field={field}
              label={m['admin.directory.collections.icon']()}
              placeholder="code"
            />
          )}
        </form.Field>
        <form.Field name="sort">
          {(field: any) => (
            <div className="space-y-1">
              <TextField
                field={field}
                label={m['admin.directory.collections.sort']()}
                type="number"
              />
              <p className="text-muted-foreground text-xs">
                {m['admin.directory.common.sort_hint']()}
              </p>
            </div>
          )}
        </form.Field>
      </DirectoryFormRow>

      <form.Field name="coverUrl">
        {(field: any) => (
          <DirectoryImageField
            label={m['admin.directory.collections.cover_url']()}
            value={field.state.value || ''}
            onChange={(url) => field.handleChange(url)}
          />
        )}
      </form.Field>

      <form.Field name="status">
        {(field: any) => (
          <div className="space-y-2">
            <Label>{m['admin.directory.common.status']()}</Label>
            <Select
              value={field.state.value}
              onValueChange={(v) =>
                field.handleChange(String(v || 'published'))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="published">
                  {tDynamic('admin.directory.status_published')}
                </SelectItem>
                <SelectItem value="draft">
                  {tDynamic('admin.directory.status_draft')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </form.Field>
    </div>
  );
}
