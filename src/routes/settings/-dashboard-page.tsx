import { useQuery } from '@tanstack/react-query';
import {
  Coins,
  Key,
  Layers,
  LifeBuoy,
  Megaphone,
  PenLine,
  Sparkles,
  User,
} from 'lucide-react';

import { useSession } from '@/core/auth/client';
import { Link } from '@/core/i18n/navigation';
import { getMyDirectoryStatsFn } from '@/modules/directory/server';
import { apiGet, type PageResult } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { useGuestPostInfo } from '@/hooks/use-guest-posts';
import { useUserFeatures } from '@/hooks/use-user-features';
import { buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import {
  formatAmount,
  formatDate,
  RECENT_SIZE,
  RecentList,
  RecentRow,
  StatCard,
  type CreditRow,
  type Order,
  type Subscription,
} from './-dashboard-widgets';

export function DashboardPage() {
  const { data: session } = useSession();

  // Cards and lists follow the admin's User Features switches.
  const features = useUserFeatures();
  // Until the switches load, fetch nothing (a page may turn out to be off).
  const guestPostInfo = useGuestPostInfo();
  const on = {
    credits: features.loaded && features.credits,
    billing: features.loaded && features.billing,
    payments: features.loaded && features.payments,
    apikeys: features.loaded && features.apikeys,
    tickets: features.loaded && features.tickets,
    guestPosts: !!guestPostInfo.data?.enabled,
  };
  // Totals only (pageSize=1): one request per number shown.
  const count = (key: unknown[], url: string, enabled: boolean) => ({
    queryKey: key,
    queryFn: () => apiGet<PageResult<unknown>>(url),
    enabled,
  });
  const ticketsQuery = useQuery(
    count(
      ['user-tickets', 'count'],
      '/api/tickets?page=1&pageSize=1',
      on.tickets
    )
  );
  const repliedQuery = useQuery(
    count(
      ['user-tickets', 'count', 'replied'],
      '/api/tickets?page=1&pageSize=1&status=replied',
      on.tickets
    )
  );
  const guestPostsQuery = useQuery(
    count(
      ['guest-posts', 'count'],
      '/api/guest-posts?page=1&pageSize=1',
      on.guestPosts
    )
  );
  const changesQuery = useQuery(
    count(
      ['guest-posts', 'count', 'changes_requested'],
      '/api/guest-posts?page=1&pageSize=1&status=changes_requested',
      on.guestPosts
    )
  );
  const reviewQuery = useQuery(
    count(
      ['guest-posts', 'count', 'submitted'],
      '/api/guest-posts?page=1&pageSize=1&status=submitted',
      on.guestPosts
    )
  );
  const creditsQuery = useQuery({
    queryKey: ['user-credits', 'balance'],
    queryFn: () => apiGet<{ balance: number }>('/api/credits'),
    enabled: on.credits,
  });
  const apiKeysQuery = useQuery({
    queryKey: ['apikeys', 'count'],
    queryFn: () =>
      apiGet<PageResult<unknown>>('/api/apikeys?page=1&pageSize=1'),
    enabled: on.apikeys,
  });
  const subscriptionQuery = useQuery({
    queryKey: ['user-subscription-current'],
    queryFn: () =>
      apiGet<Subscription | null>('/api/user/subscriptions/current'),
    enabled: on.billing,
  });
  const directoryStatsQuery = useQuery({
    queryKey: ['directory-stats', session?.user?.id],
    queryFn: () => getMyDirectoryStatsFn(),
    enabled: !!session?.user?.id,
  });
  const ordersQuery = useQuery({
    queryKey: ['user-payments', 'recent'],
    queryFn: () =>
      apiGet<PageResult<Order>>(
        `/api/user/orders?page=1&pageSize=${RECENT_SIZE}`
      ),
    enabled: on.payments,
  });
  const creditRowsQuery = useQuery({
    enabled: on.credits,
    queryKey: ['user-credits', 'recent'],
    queryFn: () =>
      apiGet<PageResult<CreditRow>>(
        `/api/user/credits?page=1&pageSize=${RECENT_SIZE}`
      ),
  });

  const loading = <Skeleton className="h-8 w-20" />;
  // No subscription comes back as `[]` (respData's null fallback).
  const subscription = subscriptionQuery.data?.status
    ? subscriptionQuery.data
    : null;

  const planValue = subscriptionQuery.isPending
    ? loading
    : subscription?.planName ||
      subscription?.productName ||
      m['settings.overview.plan_free']();
  const planHint = subscription?.canceledEndAt
    ? m['settings.billing.ends_on']({
        date: formatDate(subscription.canceledEndAt),
      })
    : subscription?.currentPeriodEnd
      ? m['settings.billing.renews_on']({
          date: formatDate(subscription.currentPeriodEnd),
        })
      : subscription
        ? m['settings.overview.plan_description']()
        : m['settings.overview.plan_free_description']();

  const name = session?.user?.name || session?.user?.email || '';
  const statCards = [
    on.billing,
    on.credits,
    on.apikeys,
    on.tickets,
    on.guestPosts,
  ].filter(Boolean).length;
  const replied = repliedQuery.data?.total ?? 0;
  const changes = changesQuery.data?.total ?? 0;
  const inReview = reviewQuery.data?.total ?? 0;
  // Nothing else to show: point at the one page every user has.
  const empty =
    features.loaded &&
    !guestPostInfo.isPending &&
    statCards === 0 &&
    !on.payments &&
    !on.credits;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {m['settings.nav.overview']()}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {name ? m['settings.welcome']({ name }) : ' '}
        </p>
      </div>

      {statCards > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {on.billing && (
            <StatCard
              href="/settings/billing"
              title={m['settings.overview.plan']()}
              icon={<Sparkles className="text-muted-foreground size-4" />}
              value={planValue}
              hint={planHint}
              action={
                !subscriptionQuery.isPending &&
                !subscription && (
                  <Link
                    href="/pricing"
                    className={buttonVariants({
                      variant: 'outline',
                      size: 'xs',
                    })}
                  >
                    {m['settings.overview.upgrade']()}
                  </Link>
                )
              }
            />
          )}
          {on.credits && (
            <StatCard
              href="/settings/credits"
              title={m['settings.credits.balance']()}
              icon={<Coins className="text-muted-foreground size-4" />}
              value={
                creditsQuery.isPending
                  ? loading
                  : (creditsQuery.data?.balance ?? '—')
              }
              hint={m['settings.billing.credits_description']()}
              action={
                <Link
                  href="/pricing"
                  className={buttonVariants({ variant: 'outline', size: 'xs' })}
                >
                  {m['settings.credits.purchase']()}
                </Link>
              }
            />
          )}
          {on.apikeys && (
            <StatCard
              href="/settings/apikeys"
              title={m['settings.apikeys.title']()}
              icon={<Key className="text-muted-foreground size-4" />}
              value={
                apiKeysQuery.isPending
                  ? loading
                  : (apiKeysQuery.data?.total ?? '—')
              }
              hint={m['settings.overview.apikeys_description']()}
            />
          )}
          {on.tickets && (
            <StatCard
              href="/settings/tickets"
              title={m['settings.nav.tickets']()}
              icon={<LifeBuoy className="text-muted-foreground size-4" />}
              value={
                ticketsQuery.isPending
                  ? loading
                  : (ticketsQuery.data?.total ?? '—')
              }
              hint={
                replied > 0
                  ? m['settings.overview.tickets_replied']({ count: replied })
                  : m['settings.overview.tickets_none']()
              }
            />
          )}
          {on.guestPosts && (
            <StatCard
              href="/settings/guest-posts"
              title={m['settings.nav.guest_posts']()}
              icon={<PenLine className="text-muted-foreground size-4" />}
              value={
                guestPostsQuery.isPending
                  ? loading
                  : (guestPostsQuery.data?.total ?? '—')
              }
              hint={
                changes > 0
                  ? m['settings.overview.guest_posts_changes']({
                      count: changes,
                    })
                  : inReview > 0
                    ? m['settings.overview.guest_posts_review']({
                        count: inReview,
                      })
                    : m['settings.overview.guest_posts_none']()
              }
            />
          )}
          <StatCard
            href="/settings/submissions"
            title={m['directory.settings_submissions_title']()}
            icon={<Layers className="text-muted-foreground size-4" />}
            value={directoryStatsQuery.data?.submissions ?? 0}
            hint={m['directory.settings_submissions_desc']()}
            action={
              <Link
                href="/submit"
                className={buttonVariants({ variant: 'outline', size: 'xs' })}
              >
                {m['directory.submit']()}
              </Link>
            }
          />
          <StatCard
            href="/settings/ads"
            title={m['directory.settings_ads_title']()}
            icon={<Megaphone className="text-muted-foreground size-4" />}
            value={directoryStatsQuery.data?.ads ?? 0}
            hint={m['directory.settings_ads_desc']()}
            action={
              <Link
                href="/advertise"
                className={buttonVariants({ variant: 'outline', size: 'xs' })}
              >
                {m['directory.for_makers']()}
              </Link>
            }
          />
        </div>
      )}

      {empty && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            href="/settings/profile"
            title={m['settings.nav.profile']()}
            icon={<User className="text-muted-foreground size-4" />}
            value={name || '—'}
            hint={m['settings.profile.description']()}
          />
        </div>
      )}

      {(on.payments || on.credits) && (
        <div
          className={cn(
            'grid gap-4',
            on.payments && on.credits && 'lg:grid-cols-2'
          )}
        >
          {on.payments && (
            <RecentList
              title={m['settings.overview.recent_payments']()}
              href="/settings/payments"
              loading={ordersQuery.isPending}
              empty={m['settings.payments.no_payments']()}
            >
              {(ordersQuery.data?.items ?? []).map((o) => (
                <RecentRow
                  key={o.id}
                  title={o.productName || o.planName || o.orderNo}
                  date={formatDate(o.paidAt || o.createdAt)}
                  value={formatAmount(o.amount, o.currency)}
                />
              ))}
            </RecentList>
          )}
          {on.credits && (
            <RecentList
              title={m['settings.overview.recent_credits']()}
              href="/settings/credits"
              loading={creditRowsQuery.isPending}
              empty={m['settings.credits.no_records']()}
            >
              {(creditRowsQuery.data?.items ?? []).map((r) => (
                <RecentRow
                  key={r.id}
                  title={r.description || r.transactionType}
                  date={formatDate(r.createdAt)}
                  value={r.credits > 0 ? `+${r.credits}` : String(r.credits)}
                  muted={r.transactionType === 'consume'}
                />
              ))}
            </RecentList>
          )}
        </div>
      )}
    </div>
  );
}
