import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { Plus } from 'lucide-react';

import { getMySponsorAdsFn } from '@/modules/directory/server';
import { m } from '@/paraglide/messages.js';
import { AdsList } from '@/components/directory/AdsList';

export const Route = createFileRoute('/settings/ads')({
  loader: async () => {
    const result = await getMySponsorAdsFn();
    if (!result.ok && result.error === 'unauthorized') {
      throw redirect({
        to: '/sign-in',
        search: { callbackUrl: '/settings/ads' } as any,
      });
    }
    return { items: result.items || [] };
  },
  component: SettingsAdsPage,
});

function SettingsAdsPage() {
  const { items } = Route.useLoaderData();

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {m['directory.settings_ads_title']()}
          </h1>
          <p className="text-muted-foreground mt-1 text-base">
            {m['directory.settings_ads_desc']()}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={'/settings/billing' as any}
            className="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-medium transition"
          >
            <span>{m['directory.settings_ads_manage_sub']()}</span>
          </Link>
          <Link
            to={'/advertise' as any}
            hash="sponsors"
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-medium transition"
          >
            <Plus className="size-3.5" />
            <span>{m['directory.settings_book_ad']()}</span>
          </Link>
        </div>
      </div>

      <AdsList items={items} />

      <p className="text-muted-foreground text-xs">
        {m['directory.settings_ads_footnote']()}
      </p>
    </div>
  );
}
