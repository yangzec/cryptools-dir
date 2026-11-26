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

import { DirectoryFormRow, DirectoryImageField } from './-form-ui';

export type Tab = 'all' | 'active' | 'pending_payment' | 'expired';
export const TABS: Tab[] = ['all', 'active', 'pending_payment', 'expired'];

export interface DirAd {
  id: string;
  name: string;
  tagline: string;
  url: string;
  iconUrl: string;
  tier: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
}

export const PAGE_SIZE = 20;
export const schema = z.object({
  name: z.string().min(1),
  tagline: z.string(),
  url: z.string().min(1),
  iconUrl: z.string(),
  tier: z.string(),
  status: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
});
export type FormValues = z.infer<typeof schema>;

export function toDatetimeLocal(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function valuesFromAd(row: DirAd): FormValues {
  return {
    name: row.name || '',
    tagline: row.tagline || '',
    url: row.url || '',
    // Keep empty when DB has no icon — list UI may favicon-fallback, but
    // seeding that URL here would persist a Google hotlink on save.
    iconUrl: row.iconUrl || '',
    tier: row.tier || 'gold',
    status: row.status || 'active',
    startsAt: toDatetimeLocal(row.startsAt),
    endsAt: toDatetimeLocal(row.endsAt),
  };
}

export function canDeleteAd(status: string) {
  return status === 'pending_payment' || status === 'expired';
}

export function canForceExpireAd(status: string) {
  return status === 'active';
}

export function renderAdFields(form: any) {
  return (
    <div className="space-y-4">
      <DirectoryFormRow>
        <form.Field name="name">
          {(field: any) => (
            <TextField
              field={field}
              label={m['admin.directory.ads.col_name']()}
            />
          )}
        </form.Field>
        <form.Field name="url">
          {(field: any) => (
            <TextField field={field} label={m['admin.directory.ads.url']()} />
          )}
        </form.Field>
      </DirectoryFormRow>
      <form.Field name="tagline">
        {(field: any) => (
          <TextField field={field} label={m['admin.directory.ads.tagline']()} />
        )}
      </form.Field>
      <form.Field name="iconUrl">
        {(field: any) => (
          <div className="space-y-1">
            <DirectoryImageField
              label={m['admin.directory.ads.icon_url']()}
              value={field.state.value || ''}
              onChange={(url) => field.handleChange(url)}
            />
            <p className="text-muted-foreground text-xs">
              {m['admin.directory.ads.icon_hint']()}
            </p>
          </div>
        )}
      </form.Field>

      <p className="text-muted-foreground text-xs">
        {m['admin.directory.ads.billing_locked_hint']()}
      </p>

      <DirectoryFormRow>
        <form.Field name="tier">
          {(field: any) => (
            <div className="space-y-2">
              <Label>{m['admin.directory.ads.tier']()}</Label>
              <Select value={field.state.value} disabled>
                <SelectTrigger className="w-full" disabled>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="silver">
                    {tDynamic('admin.directory.tier_silver')}
                  </SelectItem>
                  <SelectItem value="gold">
                    {tDynamic('admin.directory.tier_gold')}
                  </SelectItem>
                  <SelectItem value="platinum">
                    {tDynamic('admin.directory.tier_platinum')}
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
              <Select value={field.state.value} disabled>
                <SelectTrigger className="w-full" disabled>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">
                    {tDynamic('admin.directory.status_active')}
                  </SelectItem>
                  <SelectItem value="pending_payment">
                    {tDynamic('admin.directory.status_pending_payment')}
                  </SelectItem>
                  <SelectItem value="expired">
                    {tDynamic('admin.directory.status_expired')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </form.Field>
      </DirectoryFormRow>
      <DirectoryFormRow>
        <form.Field name="startsAt">
          {(field: any) => (
            <TextField
              field={field}
              label={m['admin.directory.ads.starts_at']()}
              type="datetime-local"
              disabled
            />
          )}
        </form.Field>
        <form.Field name="endsAt">
          {(field: any) => (
            <TextField
              field={field}
              label={m['admin.directory.ads.ends_at']()}
              type="datetime-local"
              disabled
            />
          )}
        </form.Field>
      </DirectoryFormRow>
    </div>
  );
}
