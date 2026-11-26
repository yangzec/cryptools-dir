import { ExternalLink } from 'lucide-react';

import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { localizeHref } from '@/paraglide/runtime.js';
import {
  formatPrice,
  type GuestPostPackage,
  type GuestPostStatus,
} from '@/hooks/use-guest-posts';
import { Card, CardContent } from '@/components/ui/card';

export function PackageOption({
  pkg,
  selected,
  disabled,
  onSelect,
}: {
  pkg: GuestPostPackage;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'rounded-xl border p-4 text-left transition-colors disabled:cursor-default',
        selected ? 'border-primary bg-accent' : 'hover:bg-muted/50'
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium">{pkg.planName}</span>
        <span className="font-semibold">
          {formatPrice(pkg.priceInCents, pkg.currency)}
        </span>
      </div>
      <p className="text-muted-foreground mt-1 text-sm">
        {m['guest_posts.package_links']({ count: pkg.maxLinks })}
      </p>
    </button>
  );
}

export function StatusPanel({
  status,
  note,
  slug,
}: {
  status: GuestPostStatus;
  note?: string | null;
  slug?: string;
}) {
  let body: React.ReactNode = null;
  if (status === 'submitted') {
    body = <p className="text-sm">{m['guest_posts.submitted_hint']()}</p>;
  } else if (status === 'changes_requested') {
    body = <p className="text-sm">{m['guest_posts.changes_hint']()}</p>;
  } else if (status === 'rejected') {
    body = <p className="text-sm">{m['guest_posts.rejected_hint']()}</p>;
  } else if (status === 'published' && slug) {
    body = (
      <a
        href={localizeHref(`/blog/${slug}`)}
        target="_blank"
        rel="noopener"
        className="text-primary inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
      >
        {m['guest_posts.view_article']()}
        <ExternalLink className="size-3.5" />
      </a>
    );
  } else if (status === 'unpublished') {
    body = <p className="text-sm">{m['guest_posts.unpublished_hint']()}</p>;
  }
  // A reviewer's note only matters while it explains the current state; an
  // earlier "please change…" shouldn't linger once the author resubmits.
  if (!['changes_requested', 'rejected', 'unpublished'].includes(status)) {
    note = null;
  }
  if (!body && !note) return null;
  return (
    <Card>
      <CardContent className="space-y-3">
        {body}
        {note && (
          <div className="bg-muted rounded-lg p-3 text-sm">
            <p className="font-medium">{m['guest_posts.review_note']()}</p>
            <p className="text-muted-foreground mt-1 whitespace-pre-line">
              {note}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
