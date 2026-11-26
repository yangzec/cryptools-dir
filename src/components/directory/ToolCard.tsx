import { Link } from '@tanstack/react-router';
import { Sparkles } from 'lucide-react';

import { tr, type ToolItem } from '@/lib/directory-data';
import { m } from '@/paraglide/messages.js';

interface ToolCardProps {
  tool: {
    id?: string;
    slug: string;
    name: string;
    tagline?: string | null;
    taglineKey?: string;
    iconUrl?: string | null;
    categoryName?: string | null;
    categoryNameKey?: string;
    featured?: boolean;
    pricing?: string;
    [key: string]: any;
  };
}

export function ToolCard({ tool }: ToolCardProps) {
  const isPaid = tool.pricing?.toLowerCase() === 'paid';
  const tagline =
    (tool as any).tagline ??
    ('taglineKey' in tool ? tr((tool as any).taglineKey) : '');
  const categoryName =
    (tool as any).categoryName ??
    ('categoryNameKey' in tool ? tr((tool as any).categoryNameKey) : '');

  return (
    <div className="group border-border bg-card hover:border-primary/35 hover:shadow-primary/25 relative flex flex-col rounded-xl border p-4 transition hover:shadow-[0_8px_24px_-12px]">
      <div className="flex items-start gap-3">
        {/* Favicon Icon */}
        <div className="border-border/60 bg-secondary/50 size-11 shrink-0 overflow-hidden rounded-lg border">
          <img
            src={tool.iconUrl || undefined}
            alt={tool.name}
            width={44}
            height={44}
            className="size-full object-cover"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="min-w-0 truncate text-[15px] leading-tight font-semibold">
              <Link
                to={`/tools/${tool.slug}` as any}
                className="after:absolute after:inset-0 after:rounded-xl"
              >
                {tool.name}
              </Link>
            </h3>
            {tool.featured && (
              <span title={m['directory.editors_pick']()} className="shrink-0">
                <Sparkles className="size-3.5 text-amber-500" />
                <span className="sr-only">{m['directory.editors_pick']()}</span>
              </span>
            )}
          </div>
          <p className="text-muted-foreground mt-1 line-clamp-2 min-h-10 text-[13px] leading-5">
            {tagline}
          </p>
        </div>
      </div>

      {/* Footer Badges */}
      <div className="mt-3 flex items-center gap-2">
        {isPaid && (
          <span className="bg-primary/10 text-primary shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold">
            {m['directory.pricing_paid']()}
          </span>
        )}
        <span className="bg-secondary text-secondary-foreground ml-auto min-w-0 truncate rounded-md px-2 py-0.5 text-[11px] font-medium">
          {categoryName}
        </span>
      </div>
    </div>
  );
}
