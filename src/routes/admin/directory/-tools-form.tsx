import { tDynamic } from '@/core/i18n/dynamic';
import { m } from '@/paraglide/messages.js';
import { TextField } from '@/components/form-field';
import { Checkbox } from '@/components/ui/checkbox';
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
import type { Option } from './-tools-shared';

export function renderToolFields(
  form: any,
  cats: Option[],
  tags: Option[],
  opts?: { lockMeta?: boolean }
) {
  const lockMeta = Boolean(opts?.lockMeta);

  return (
    <div className="space-y-4">
      <DirectoryLocaleSection>
        {(locale) => (
          <>
            <form.Field name={localeField('name', locale)}>
              {(field: any) => (
                <TextField
                  field={field}
                  label={m['admin.directory.common.name']()}
                />
              )}
            </form.Field>
            <form.Field name={localeField('tagline', locale)}>
              {(field: any) => (
                <TextField
                  field={field}
                  label={m['admin.directory.tools.tagline']()}
                />
              )}
            </form.Field>
            <form.Field name={localeField('introduction', locale)}>
              {(field: any) => (
                <TextField
                  field={field}
                  label={m['admin.directory.tools.introduction']()}
                />
              )}
            </form.Field>
          </>
        )}
      </DirectoryLocaleSection>

      <DirectoryFormRow>
        <form.Field name="slug">
          {(field: any) => (
            <TextField
              field={field}
              label={m['admin.directory.common.slug']()}
              disabled={lockMeta}
            />
          )}
        </form.Field>
        <form.Field name="websiteUrl">
          {(field: any) => (
            <TextField
              field={field}
              label={m['admin.directory.tools.website']()}
            />
          )}
        </form.Field>
      </DirectoryFormRow>
      {lockMeta ? (
        <p className="text-muted-foreground -mt-2 text-xs">
          {m['admin.directory.common.slug_locked_hint']()}
        </p>
      ) : null}

      <form.Field name="iconUrl">
        {(field: any) => (
          <DirectoryImageField
            label={m['admin.directory.tools.icon_url']()}
            value={field.state.value || ''}
            onChange={(url) => field.handleChange(url)}
          />
        )}
      </form.Field>

      <DirectoryFormRow>
        <form.Field name="authorName">
          {(field: any) => (
            <TextField
              field={field}
              label={m['admin.directory.tools.author']()}
            />
          )}
        </form.Field>
        <form.Field name="sort">
          {(field: any) => (
            <div className="space-y-1">
              <TextField
                field={field}
                label={m['admin.directory.tools.sort']()}
                type="number"
              />
              <p className="text-muted-foreground text-xs">
                {m['admin.directory.tools.sort_hint']()}
              </p>
            </div>
          )}
        </form.Field>
      </DirectoryFormRow>

      {/* Compact selects: pricing + category stay editable after create. */}
      <DirectoryFormRow>
        <form.Field name="pricing">
          {(field: any) => (
            <div className="space-y-2">
              <Label>{m['admin.directory.tools.pricing']()}</Label>
              <Select
                value={field.state.value || 'free'}
                onValueChange={(v) => field.handleChange(String(v || 'free'))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">
                    {m['directory.pricing_free']()}
                  </SelectItem>
                  <SelectItem value="freemium">
                    {m['directory.pricing_freemium']()}
                  </SelectItem>
                  <SelectItem value="paid">
                    {m['directory.pricing_paid']()}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </form.Field>
        <form.Field name="categoryId">
          {(field: any) => (
            <div className="space-y-2">
              <Label>{m['admin.directory.tools.category']()}</Label>
              <Select
                value={field.state.value || '__none__'}
                onValueChange={(v) =>
                  field.handleChange(v === '__none__' ? '' : String(v || ''))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    {m['admin.directory.tools.no_category']()}
                  </SelectItem>
                  {cats.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </form.Field>
      </DirectoryFormRow>

      {/* Source + status: locked after create (use list actions for status). */}
      {lockMeta ? (
        <p className="text-muted-foreground text-xs">
          {m['admin.directory.tools.meta_locked_hint']()}
        </p>
      ) : null}
      <DirectoryFormRow>
        <form.Field name="source">
          {(field: any) => (
            <div className="space-y-2">
              <Label>{m['admin.directory.tools.source']()}</Label>
              <Select
                value={field.state.value}
                disabled={lockMeta}
                onValueChange={(v) =>
                  field.handleChange(String(v || 'editorial'))
                }
              >
                <SelectTrigger className="w-full" disabled={lockMeta}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="editorial">
                    {tDynamic('admin.directory.source_editorial')}
                  </SelectItem>
                  <SelectItem value="community">
                    {tDynamic('admin.directory.source_community')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </form.Field>
        <form.Field name="status">
          {(field: any) => (
            <div className="space-y-2">
              <Label>{m['admin.directory.common.status']()}</Label>
              <Select
                value={field.state.value}
                disabled={lockMeta}
                onValueChange={(v) =>
                  field.handleChange(String(v || 'published'))
                }
              >
                <SelectTrigger className="w-full" disabled={lockMeta}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="published">
                    {tDynamic('admin.directory.status_published')}
                  </SelectItem>
                  <SelectItem value="pending">
                    {tDynamic('admin.directory.status_pending')}
                  </SelectItem>
                  <SelectItem value="pending_payment">
                    {tDynamic('admin.directory.status_pending_payment')}
                  </SelectItem>
                  <SelectItem value="rejected">
                    {tDynamic('admin.directory.status_rejected')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </form.Field>
      </DirectoryFormRow>

      {/* Ranking / badge flags — not taxonomy (tags are below). */}
      <div className="bg-muted/20 space-y-3 rounded-lg border p-3">
        <div className="space-y-1">
          <p className="text-sm font-medium">
            {m['admin.directory.tools.listing_flags']()}
          </p>
          <p className="text-muted-foreground text-xs">
            {m['admin.directory.tools.listing_flags_hint']()}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <form.Field name="featured">
            {(field: any) => (
              <label className="bg-background flex cursor-pointer gap-2 rounded-md border p-3 text-sm">
                <Checkbox
                  className="mt-0.5"
                  checked={field.state.value}
                  onCheckedChange={(v) => field.handleChange(Boolean(v))}
                />
                <span className="min-w-0 space-y-0.5">
                  <span className="block font-medium">
                    {m['admin.directory.tools.featured']()}
                  </span>
                  <span className="text-muted-foreground block text-xs leading-snug">
                    {m['admin.directory.tools.featured_hint']()}
                  </span>
                </span>
              </label>
            )}
          </form.Field>
          <form.Field name="sponsored">
            {(field: any) => (
              <label className="bg-background flex cursor-pointer gap-2 rounded-md border p-3 text-sm">
                <Checkbox
                  className="mt-0.5"
                  checked={field.state.value}
                  onCheckedChange={(v) => field.handleChange(Boolean(v))}
                />
                <span className="min-w-0 space-y-0.5">
                  <span className="block font-medium">
                    {m['admin.directory.tools.sponsored']()}
                  </span>
                  <span className="text-muted-foreground block text-xs leading-snug">
                    {m['admin.directory.tools.sponsored_hint']()}
                  </span>
                </span>
              </label>
            )}
          </form.Field>
        </div>
      </div>

      <form.Field name="tagIds">
        {(field: any) => (
          <div className="space-y-2">
            <div className="space-y-1">
              <Label>{m['admin.directory.tools.tags']()}</Label>
              <p className="text-muted-foreground text-xs">
                {m['admin.directory.tools.tags_hint']()}
              </p>
            </div>
            <div className="grid max-h-40 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
              {tags.map((tag) => {
                const checked = field.state.value.includes(tag.id);
                return (
                  <label
                    key={tag.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => {
                        const next = v
                          ? [...field.state.value, tag.id]
                          : field.state.value.filter(
                              (id: string) => id !== tag.id
                            );
                        field.handleChange(next);
                      }}
                    />
                    <span className="truncate">{tag.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </form.Field>
    </div>
  );
}
