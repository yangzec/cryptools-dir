import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { Megaphone, Plus } from 'lucide-react';

import { getMySubmissionsFn } from '@/modules/directory/server';
import { m } from '@/paraglide/messages.js';
import { getLocale } from '@/paraglide/runtime.js';
import { SubmissionsList } from '@/components/directory/SubmissionsList';

export const Route = createFileRoute('/settings/submissions')({
  loader: async () => {
    const locale = getLocale();
    const result = await getMySubmissionsFn({ data: { locale } });
    if (!result.ok && result.error === 'unauthorized') {
      throw redirect({
        to: '/sign-in',
        search: { callbackUrl: '/settings/submissions' } as any,
      });
    }
    return { items: result.items || [] };
  },
  component: SettingsSubmissionsPage,
});

function SettingsSubmissionsPage() {
  const { items } = Route.useLoaderData();

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {m['directory.settings_submissions_title']()}
          </h1>
          <p className="text-muted-foreground mt-1 text-base">
            {m['directory.settings_submissions_desc']()}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={'/advertise' as any}
            className="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition"
          >
            <Megaphone className="size-3.5" />
            <span>{m['directory.settings_become_sponsor']()}</span>
          </Link>
          <Link
            to={'/submit' as any}
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-medium transition"
          >
            <Plus className="size-3.5" />
            <span>{m['directory.settings_submit_short']()}</span>
          </Link>
        </div>
      </div>

      <SubmissionsList items={items} />
    </div>
  );
}
