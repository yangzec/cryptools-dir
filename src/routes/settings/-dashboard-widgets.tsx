import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

import { Link } from '@/core/i18n/navigation';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export type Subscription = {
  status: string;
  planName?: string | null;
  productName?: string | null;
  currentPeriodEnd?: string | null;
  canceledEndAt?: string | null;
};

export type Order = {
  id: string;
  orderNo: string;
  amount: number;
  currency: string;
  productName?: string | null;
  planName?: string | null;
  paidAt?: string | null;
  createdAt: string;
};

export type CreditRow = {
  id: string;
  transactionType: string;
  credits: number;
  description?: string | null;
  createdAt: string;
};

export const RECENT_SIZE = 5;

export function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: (currency || 'usd').toUpperCase(),
  }).format(amount / 100);
}

export function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString() : '';
}

export function StatCard({
  href,
  title,
  icon,
  value,
  hint,
  action,
}: {
  href: string;
  title: string;
  icon: ReactNode;
  value: ReactNode;
  hint: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Card className="hover:bg-muted/40 relative transition-colors">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium">
          {title}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent className="space-y-1">
        <Link href={href} className="block after:absolute after:inset-0">
          <div className="truncate text-2xl font-semibold tabular-nums">
            {value}
          </div>
        </Link>
        <div className="flex items-center justify-between gap-2">
          <p className="text-muted-foreground truncate text-xs">{hint}</p>
          {action && <div className="relative z-10 shrink-0">{action}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

export function RecentList({
  title,
  href,
  loading,
  empty,
  children,
}: {
  title: string;
  href: string;
  loading: boolean;
  empty: string;
  children: ReactNode[];
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        <Link
          href={href}
          className="text-muted-foreground hover:text-foreground flex items-center gap-0.5 text-sm"
        >
          {m['settings.overview.view_all']()}
          <ChevronRight className="size-4" />
        </Link>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : children.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            {empty}
          </p>
        ) : (
          <ul className="divide-border divide-y">{children}</ul>
        )}
      </CardContent>
    </Card>
  );
}

export function RecentRow({
  title,
  date,
  value,
  muted,
}: {
  title: string;
  date: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm">{title}</p>
        <p className="text-muted-foreground text-xs">{date}</p>
      </div>
      <span
        className={cn(
          'shrink-0 text-sm font-medium tabular-nums',
          muted && 'text-muted-foreground'
        )}
      >
        {value}
      </span>
    </li>
  );
}
