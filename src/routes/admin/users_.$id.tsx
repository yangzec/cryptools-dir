import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft, Copy } from 'lucide-react';
import { toast } from 'sonner';

import { apiGet } from '@/lib/api-client';
import { formatDateTime } from '@/lib/time';
import { m } from '@/paraglide/messages.js';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import { UserCredits } from './-user-credits';
import { UserOrders } from './-user-orders';
import { UserTimeline } from './-user-timeline';

interface UserDetail {
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image: string | null;
    createdAt: string;
    utmSource: string;
    utmMedium: string;
    utmCampaign: string;
    utmTerm: string;
    utmContent: string;
    referrer: string;
    ip: string;
    country: string;
    locale: string;
  };
  roles: { roleId: string; roleName: string; roleTitle: string }[];
  stats: {
    creditBalance: number;
    creditsGranted: number;
    creditsConsumed: number;
    orderCount: number;
    lastOrderAt: string | null;
    paidOrderCount: number;
    paidAmounts: { currency: string; amount: number }[];
  };
}

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(amount / 100);
}

function Empty() {
  return <span className="text-muted-foreground">—</span>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-1">
        <p className="text-muted-foreground text-sm">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function UserDetailPage() {
  const { id } = Route.useParams();

  const detailQuery = useQuery({
    queryKey: ['admin-user', id],
    queryFn: () =>
      apiGet<UserDetail>(`/api/admin/users/${encodeURIComponent(id)}`),
  });

  if (detailQuery.isPending) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-16 w-72" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div className="space-y-4 p-6">
        <BackLink />
        <p className="text-muted-foreground">
          {detailQuery.error?.message || m['admin.user_detail.not_found']()}
        </p>
      </div>
    );
  }

  const { user, roles, stats } = detailQuery.data;
  const utmFields = [
    ['utm_source', user.utmSource],
    ['utm_medium', user.utmMedium],
    ['utm_campaign', user.utmCampaign],
    ['utm_term', user.utmTerm],
    ['utm_content', user.utmContent],
  ] as const;

  return (
    <div className="space-y-6 p-6">
      <BackLink />

      <div className="flex flex-wrap items-center gap-4">
        <Avatar className="size-14">
          <AvatarImage src={user.image || undefined} />
          <AvatarFallback>
            {(user.name || user.email).charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold">{user.name || '—'}</h1>
          <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
            <span className="truncate">{user.email}</span>
            <Badge variant={user.emailVerified ? 'default' : 'secondary'}>
              {user.emailVerified
                ? m['admin.user_detail.email_verified']()
                : m['admin.user_detail.email_unverified']()}
            </Badge>
            <span>
              {m['admin.user_detail.joined']({
                date: formatDateTime(user.createdAt),
              })}
            </span>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            navigator.clipboard
              .writeText(user.email)
              .then(() => toast.success(m['admin.user_detail.copied']()));
          }}
        >
          <Copy className="size-4" />
          {m['admin.user_detail.copy_email']()}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label={m['admin.user_detail.stat_balance']()}
          value={stats.creditBalance.toLocaleString()}
        />
        <Stat
          label={m['admin.user_detail.stat_granted']()}
          value={stats.creditsGranted.toLocaleString()}
        />
        <Stat
          label={m['admin.user_detail.stat_consumed']()}
          value={stats.creditsConsumed.toLocaleString()}
        />
        <Stat
          label={m['admin.user_detail.stat_paid']()}
          value={
            stats.paidAmounts.length > 0
              ? stats.paidAmounts
                  .map((p) => formatAmount(p.amount, p.currency))
                  .join(' + ')
              : formatAmount(0, 'USD')
          }
          hint={m['admin.user_detail.stat_orders']({
            paid: stats.paidOrderCount,
            total: stats.orderCount,
          })}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{m['admin.user_detail.attribution_title']()}</CardTitle>
          <CardDescription>
            {m['admin.user_detail.attribution_desc']()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-8 md:grid-cols-2">
            <div className="divide-y">
              <Field label={m['admin.user_detail.referrer']()}>
                {user.referrer ? (
                  <a
                    href={user.referrer}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="font-mono text-xs underline-offset-4 hover:underline"
                  >
                    {user.referrer}
                  </a>
                ) : (
                  <span className="text-muted-foreground">
                    {m['admin.user_detail.direct']()}
                  </span>
                )}
              </Field>
              {utmFields.map(([label, value]) => (
                <Field key={label} label={label}>
                  {value ? (
                    <span className="bg-muted inline-flex rounded-md px-2 py-0.5 text-xs font-medium">
                      {value}
                    </span>
                  ) : (
                    <Empty />
                  )}
                </Field>
              ))}
            </div>
            <div className="divide-y">
              <Field label={m['admin.user_detail.ip']()}>
                {user.ip ? (
                  <span className="font-mono text-xs">{user.ip}</span>
                ) : (
                  <Empty />
                )}
              </Field>
              <Field label={m['admin.user_detail.country']()}>
                {user.country || <Empty />}
              </Field>
              <Field label={m['admin.user_detail.locale']()}>
                {user.locale || <Empty />}
              </Field>
              <Field label={m['admin.user_detail.roles']()}>
                {roles.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {roles.map((r) => (
                      <Badge key={r.roleId} variant="outline">
                        {r.roleTitle || r.roleName}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground">
                    {m['admin.user_detail.no_roles']()}
                  </span>
                )}
              </Field>
            </div>
          </dl>
        </CardContent>
      </Card>

      <UserTimeline userId={user.id} />
      <UserOrders userId={user.id} />
      <UserCredits userId={user.id} />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/admin/users"
      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
    >
      <ArrowLeft className="size-4" />
      {m['admin.user_detail.back']()}
    </Link>
  );
}

export const Route = createFileRoute('/admin/users_/$id')({
  component: UserDetailPage,
});
