import { useEffect, useState } from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { Eye, MoreHorizontal, Plus, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import { tDynamic } from '@/core/i18n/dynamic';
import { Link } from '@/core/i18n/navigation';
import { ApiError, apiGet, apiPost, type PageResult } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { DataTable, type Column } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { BillingDialogs } from './-billing-dialogs';
import {
  formatAmount,
  formatInterval,
  isCancellable,
  isSponsorSubscription,
  PAGE_SIZE,
  statusLabel,
  statusVariant,
  subscriptionTitle,
  TABS,
  type Subscription,
  type Tab,
} from './-billing-shared';

export function BillingPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [viewing, setViewing] = useState<Subscription | null>(null);
  const [canceling, setCanceling] = useState<Subscription | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [tab, debouncedSearch]);

  const activeQuery = useQuery({
    queryKey: ['billing', 'active'],
    queryFn: () =>
      apiGet<Subscription[]>('/api/user/subscriptions?activeOnly=1'),
  });
  const activeRows = Array.isArray(activeQuery.data) ? activeQuery.data : [];
  const activeLoaded = !activeQuery.isPending;
  const planRows = activeRows.filter((r) => !isSponsorSubscription(r));
  const sponsorRows = activeRows.filter((r) => isSponsorSubscription(r));

  const listQuery = useQuery({
    queryKey: ['billing', 'list', page, tab, debouncedSearch],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (tab !== 'all') params.set('status', tab);
      if (debouncedSearch) params.set('search', debouncedSearch);
      return apiGet<PageResult<Subscription>>(
        `/api/user/subscriptions?${params}`
      );
    },
    placeholderData: keepPreviousData,
  });
  const rows = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;

  const cancelMutation = useMutation({
    mutationFn: (subscriptionNo: string) =>
      apiPost('/api/user/subscriptions/cancel', { subscriptionNo }),
    onSuccess: () => {
      toast.success(m['settings.billing.cancel_success']());
      setCanceling(null);
      queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiError
          ? err.message || m['settings.billing.cancel_failed']()
          : m['settings.billing.cancel_failed']()
      );
    },
  });
  const submitting = cancelMutation.isPending;

  function confirmCancel() {
    if (!canceling) return;
    cancelMutation.mutate(canceling.subscriptionNo);
  }

  function periodHint(sub: Subscription) {
    if (sub.canceledEndAt) {
      return m['settings.billing.ends_on']({
        date: new Date(sub.canceledEndAt).toLocaleDateString(),
      });
    }
    if (sub.currentPeriodEnd) {
      return m['settings.billing.renews_on']({
        date: new Date(sub.currentPeriodEnd).toLocaleDateString(),
      });
    }
    return null;
  }

  function ActiveSubCard({ sub }: { sub: Subscription }) {
    const sponsor = isSponsorSubscription(sub);
    const hint = periodHint(sub);
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-lg">
                  {subscriptionTitle(sub)}
                </CardTitle>
                <Badge variant="outline">
                  {sponsor
                    ? m['settings.billing.kind_sponsor']()
                    : m['settings.billing.kind_plan']()}
                </Badge>
                <Badge variant={statusVariant(sub.status)}>
                  {statusLabel(sub.status)}
                </Badge>
              </div>
              {sub.amount && sub.currency ? (
                <p className="text-muted-foreground text-sm">
                  {formatAmount(sub.amount, sub.currency)}
                  {sub.interval
                    ? ` / ${formatInterval(sub.interval, sub.intervalCount)}`
                    : ''}
                </p>
              ) : null}
              {hint ? (
                <p
                  className={cn(
                    'text-sm',
                    sub.canceledEndAt
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                  )}
                >
                  {hint}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {sponsor ? (
                <Link
                  href="/settings/ads"
                  className={cn(
                    buttonVariants({ variant: 'outline', size: 'sm' })
                  )}
                >
                  {m['settings.billing.manage_ads']()}
                </Link>
              ) : null}
              {isCancellable(sub.status) ? (
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setCanceling(sub)}
                >
                  <XCircle className="size-4" />
                  {m['settings.billing.cancel']()}
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  const columns: Column<Subscription>[] = [
    {
      header: m['settings.billing.subscription_no'](),
      cell: (r) => (
        <span className="font-mono text-xs">{r.subscriptionNo}</span>
      ),
    },
    {
      header: m['settings.billing.plan'](),
      cell: (r) => (
        <div className="space-y-1">
          <span className="font-medium">{subscriptionTitle(r)}</span>
          {isSponsorSubscription(r) ? (
            <Badge variant="outline" className="text-[10px]">
              {m['settings.billing.kind_sponsor']()}
            </Badge>
          ) : null}
        </div>
      ),
    },
    {
      header: m['settings.billing.interval'](),
      cell: (r) =>
        r.interval ? (
          <span className="text-sm">
            {formatInterval(r.interval, r.intervalCount)}
          </span>
        ) : (
          '—'
        ),
    },
    {
      header: m['settings.billing.status'](),
      cell: (r) => (
        <Badge variant={statusVariant(r.status)}>{statusLabel(r.status)}</Badge>
      ),
    },
    {
      header: m['settings.billing.amount'](),
      cell: (r) =>
        r.amount && r.currency ? (
          <span className="tabular-nums">
            {formatAmount(r.amount, r.currency)}
          </span>
        ) : (
          '—'
        ),
    },
    {
      header: m['settings.billing.current_period'](),
      cell: (r) => (
        <span className="text-muted-foreground text-xs whitespace-pre-line">
          {r.currentPeriodStart && r.currentPeriodEnd
            ? `${new Date(r.currentPeriodStart).toLocaleDateString()}\n~ ${new Date(r.currentPeriodEnd).toLocaleDateString()}`
            : '—'}
        </span>
      ),
    },
    {
      header: m['settings.billing.end_time'](),
      cell: (r) => (
        <span className="text-muted-foreground text-sm">
          {r.canceledEndAt
            ? new Date(r.canceledEndAt).toLocaleDateString()
            : '—'}
        </span>
      ),
    },
    {
      header: m['settings.billing.date'](),
      cell: (r) => (
        <span className="text-muted-foreground text-sm">
          {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}
        </span>
      ),
    },
    {
      header: m['settings.billing.actions_col'](),
      className: 'w-[80px]',
      cell: (r) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" className="size-7">
                <MoreHorizontal className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setViewing(r)}>
              <Eye className="size-4" />
              {m['settings.billing.view']()}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => isCancellable(r.status) && setCanceling(r)}
              disabled={!isCancellable(r.status)}
            >
              <XCircle className="size-4" />
              {m['settings.billing.cancel']()}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">{m['settings.billing.title']()}</h1>
        <p className="text-muted-foreground">
          {m['settings.billing.description']()}
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">
            {m['settings.billing.active_subscriptions']()}
          </h2>
          <Link
            href="/advertise"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'gap-1.5'
            )}
          >
            <Plus className="size-3.5" />
            {m['settings.billing.book_sponsor']()}
          </Link>
        </div>

        {!activeLoaded ? (
          <p className="text-muted-foreground text-sm">…</p>
        ) : activeRows.length === 0 ? (
          <Card className="max-w-lg">
            <CardContent className="text-muted-foreground py-6 text-sm">
              {m['settings.billing.no_subscription']()}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {planRows.map((sub) => (
              <ActiveSubCard key={sub.id} sub={sub} />
            ))}
            {sponsorRows.map((sub) => (
              <ActiveSubCard key={sub.id} sub={sub} />
            ))}
          </div>
        )}
      </div>

      <div className="border-border flex gap-1 overflow-x-auto overflow-y-hidden border-b">
        {TABS.map((tb) => (
          <button
            key={tb}
            onClick={() => setTab(tb)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors',
              tab === tb
                ? 'border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground border-transparent'
            )}
          >
            {tDynamic(`settings.billing.tab_${tb}`)}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">
            {m['settings.billing.subscriptions']()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={rows}
            total={total}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            rowKey={(r) => r.id}
            emptyText={m['settings.billing.no_subscription']()}
            search={search}
            onSearchChange={setSearch}
            onRefresh={async () => {
              activeQuery.refetch();
              await listQuery.refetch();
            }}
            loading={listQuery.isFetching || listQuery.isPending}
          />
        </CardContent>
      </Card>

      <BillingDialogs
        viewing={viewing}
        setViewing={setViewing}
        canceling={canceling}
        setCanceling={setCanceling}
        confirmCancel={confirmCancel}
        submitting={submitting}
      />
    </div>
  );
}
