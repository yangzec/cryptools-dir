import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { apiGet, type PageResult } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { DataTable, type Column } from '@/components/data-table';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserCell } from '@/components/user-cell';

import {
  formatAmounts,
  formatMoney,
  type CurrencyAmount,
} from './-affiliate-shared';

type Statistic = {
  userId: string;
  userName: string;
  userEmail: string;
  userAvatar: string | null;
  rank: number;
  inviteCount: number;
  invitePaidCount: number;
  paidRate: number;
  paidCount: number;
  paidFromNewInvites: number;
  paidFromOldInvites: number;
  rewardAmount: number;
  withdrawAmount: number;
  unwithdrawnAmount: number;
  rewardAmounts: CurrencyAmount[];
  withdrawAmounts: CurrencyAmount[];
  unwithdrawnAmounts: CurrencyAmount[];
  currency: string;
};

type StatisticsResult = PageResult<Statistic> & {
  conversion: { currency: string; date: string; source: string } | null;
};

const PAGE_SIZE = 20;
const TIME_RANGES = ['all', '24h', '7d', '30d'] as const;
const SORTS = [
  'inviteCount',
  'paidRate',
  'rewardAmount',
  'withdrawAmount',
] as const;
const CURRENCIES = ['ALL', 'USD', 'EUR', 'CNY'] as const;

export function AffiliateStatistics() {
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<string>('inviteCount');
  const [timeRange, setTimeRange] = useState<string>('all');
  const [currency, setCurrency] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [debounced, sortBy, timeRange, currency]);

  const query = useQuery({
    queryKey: [
      'admin-affiliate-statistics',
      page,
      sortBy,
      currency,
      timeRange,
      debounced,
    ],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        sortBy,
        currency,
        timeRange,
      });
      if (debounced) params.set('search', debounced);
      return apiGet<StatisticsResult>(
        `/api/admin/affiliates/statistics?${params}`
      );
    },
    placeholderData: keepPreviousData,
  });

  const converted = !!query.data?.conversion;

  const timeLabels: Record<string, string> = {
    all: m['admin.affiliates.statistics.time_all'](),
    '24h': m['admin.affiliates.statistics.time_24h'](),
    '7d': m['admin.affiliates.statistics.time_7d'](),
    '30d': m['admin.affiliates.statistics.time_30d'](),
  };
  const sortLabels: Record<string, string> = {
    inviteCount: m['admin.affiliates.statistics.sort_invites'](),
    paidRate: m['admin.affiliates.statistics.sort_paid_rate'](),
    rewardAmount: m['admin.affiliates.statistics.sort_rewards'](),
    withdrawAmount: m['admin.affiliates.statistics.sort_withdrawals'](),
  };

  const columns: Column<Statistic>[] = [
    {
      header: m['admin.affiliates.statistics.rank'](),
      className: 'w-[64px]',
      cell: (r) => <span className="tabular-nums">{r.rank}</span>,
    },
    {
      header: m['admin.affiliates.fields.affiliate'](),
      cell: (r) => (
        <UserCell
          userId={r.userId}
          name={r.userName}
          email={r.userEmail}
          image={r.userAvatar}
        />
      ),
    },
    {
      header: m['admin.affiliates.statistics.invite_count'](),
      className: 'text-right tabular-nums',
      cell: (r) => <Count value={r.inviteCount} />,
    },
    {
      header: m['admin.affiliates.statistics.invite_paid_count'](),
      className: 'text-right tabular-nums',
      cell: (r) =>
        r.inviteCount ? (
          <span className="whitespace-nowrap">
            {r.invitePaidCount}
            <span className="text-muted-foreground ml-1.5">
              ({(r.paidRate * 100).toFixed(0)}%)
            </span>
          </span>
        ) : (
          <Count value={0} />
        ),
    },
    {
      header: m['admin.affiliates.statistics.paid_count'](),
      className: 'text-right tabular-nums',
      cell: (r) => <PaidCustomersCell row={r} />,
    },
    {
      header: m['admin.affiliates.statistics.reward_amount'](),
      className: 'text-right',
      cell: (r) => (
        <AmountCell
          amounts={r.rewardAmounts}
          usdMinor={converted ? r.rewardAmount : undefined}
        />
      ),
    },
    {
      header: m['admin.affiliates.statistics.withdraw_amount'](),
      className: 'text-right',
      cell: (r) => (
        <AmountCell
          amounts={r.withdrawAmounts}
          usdMinor={converted ? r.withdrawAmount : undefined}
          tone="paid"
        />
      ),
    },
    {
      header: m['admin.affiliates.statistics.unwithdrawn_amount'](),
      className: 'text-right',
      cell: (r) => (
        <AmountCell
          amounts={r.unwithdrawnAmounts}
          usdMinor={converted ? r.unwithdrawnAmount : undefined}
          tone="unwithdrawn"
        />
      ),
    },
  ];

  return (
    <Card>
      <CardContent className="space-y-4">
        <details className="group text-muted-foreground text-sm">
          <summary className="cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden">
            {m['admin.affiliates.statistics.summary']()}{' '}
            <span className="text-foreground underline-offset-4 group-open:hidden hover:underline">
              {m['admin.affiliates.statistics.more']()}
            </span>
          </summary>
          <div className="mt-2 space-y-1">
            <p>{m['admin.affiliates.statistics.description']()}</p>
            {currency === 'ALL' && (
              <p>
                {m['admin.affiliates.statistics.conversion']({
                  date: query.data?.conversion?.date || '—',
                })}
              </p>
            )}
          </div>
        </details>
        {query.isError && (
          <p role="alert" className="text-destructive text-sm">
            {currency === 'ALL'
              ? m['admin.affiliates.statistics.conversion_error']()
              : m['admin.affiliates.statistics.error']()}
          </p>
        )}
        <DataTable
          columns={columns}
          data={query.data?.items ?? []}
          total={query.data?.total ?? 0}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          rowKey={(r) => r.userId}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={m['admin.affiliates.search_affiliates']()}
          emptyText={m['admin.affiliates.empty']()}
          loading={query.isFetching}
          onRefresh={() => query.refetch()}
          toolbar={
            <>
              <Select
                value={timeRange}
                onValueChange={(v) => setTimeRange(v || 'all')}
              >
                <SelectTrigger className="h-8 w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_RANGES.map((v) => (
                    <SelectItem key={v} value={v}>
                      {timeLabels[v]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={sortBy}
                onValueChange={(v) => setSortBy(v || 'inviteCount')}
              >
                <SelectTrigger className="h-8 w-[170px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORTS.map((v) => (
                    <SelectItem key={v} value={v}>
                      {sortLabels[v]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={currency}
                onValueChange={(v) => setCurrency(v || 'ALL')}
              >
                <SelectTrigger className="h-8 w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v === 'ALL'
                        ? m['admin.affiliates.statistics.all_currencies']()
                        : v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          }
        />
      </CardContent>
    </Card>
  );
}

function Count({ value }: { value: number }) {
  return value ? (
    <>{value}</>
  ) : (
    <span className="text-muted-foreground">—</span>
  );
}

/** Period customers with the source breakdown underneath. */
function PaidCustomersCell({ row }: { row: Statistic }) {
  if (!row.paidCount) return <Count value={0} />;
  const parts = [
    [
      row.paidFromNewInvites,
      m['admin.affiliates.statistics.paid_from_new_invites'](),
    ],
    [
      row.paidFromOldInvites,
      m['admin.affiliates.statistics.paid_from_old_invites'](),
    ],
  ] as const;
  return (
    <div className="space-y-1">
      <div>{row.paidCount}</div>
      <div className="text-muted-foreground text-xs whitespace-nowrap">
        {parts
          .filter(([count]) => count > 0)
          .map(([count, label]) => `${label} ${count}`)
          .join(' · ')}
      </div>
    </div>
  );
}

/** Amounts per currency, plus a USD line only when a non-USD one is involved. */
function AmountCell({
  amounts,
  usdMinor,
  tone,
}: {
  amounts: CurrencyAmount[];
  usdMinor?: number;
  tone?: 'paid' | 'unwithdrawn';
}) {
  if (!amounts.some((a) => a.amount > 0))
    return <span className="text-muted-foreground">—</span>;
  const label = (
    <span
      className={cn(
        'whitespace-nowrap tabular-nums',
        tone === 'paid' && 'text-emerald-700 dark:text-emerald-400',
        tone === 'unwithdrawn' &&
          'font-medium text-amber-700 dark:text-amber-400'
      )}
    >
      {formatAmounts(amounts)}
    </span>
  );
  const showUsd =
    usdMinor !== undefined &&
    amounts.some((a) => a.currency.toUpperCase() !== 'USD');
  if (!showUsd) return label;
  return (
    <div className="space-y-1">
      <div>{label}</div>
      <div className="text-muted-foreground text-xs whitespace-nowrap">
        ≈ {formatMoney(usdMinor, 'USD')}
      </div>
    </div>
  );
}
