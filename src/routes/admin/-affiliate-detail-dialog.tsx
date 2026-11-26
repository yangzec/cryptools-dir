import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { tDynamic } from '@/core/i18n/dynamic';
import { apiGet, type PageResult } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { DataTable, type Column } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import {
  AffiliateStatusBadge,
  DateCell,
  formatAmounts,
  MoneyText,
  PaidBadge,
  PlainUser,
  RewardStatusBadge,
  RewardTypeBadge,
  RewardValue,
  TabStrip,
  WithdrawStatusBadge,
  type CurrencyAmount,
} from './-affiliate-shared';

export interface AffiliateRow {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  userAvatar: string | null;
  status: string;
  /** Own cash commission percent; 0 = the global setting. */
  commissionPercent: number;
  effectiveCommissionPercent: number;
  applyReason: string;
  createdAt: string;
  inviteCodes: { code: string; isDefault: boolean }[];
}

interface DetailSummary {
  affiliate: (AffiliateRow & { effectiveCommissionPercent: number }) | null;
  inviteTotal: number;
  rewardTotal: number;
  rewardAmounts: CurrencyAmount[];
  withdrawAmounts: CurrencyAmount[];
  rewardBalances: CurrencyAmount[];
  pendingBalances?: CurrencyAmount[];
  hasPendingWithdraw: boolean;
  inviteCodes: { id: string; code: string; isDefault: boolean }[];
}

interface DetailInvite {
  id: string;
  inviteCode: string;
  createdAt: string;
  invitedUserName: string | null;
  invitedUserAvatar: string | null;
  paid: boolean;
  firstPaidAmount: number | null;
  firstPaidCurrency: string | null;
}

interface DetailReward {
  id: string;
  transactionNo: string;
  orderNo: string;
  rewardType: string;
  rewardAmount: number;
  rewardCurrency: string;
  status: string;
  createdAt: string;
  paidAmount: number | null;
  paidCurrency: string | null;
  paidUserName: string | null;
  paidUserAvatar: string | null;
}

interface DetailWithdraw {
  id: string;
  transactionNo: string;
  amount: number;
  currency: string;
  status: string;
  remark: string;
  createdAt: string;
}

const KINDS = ['invites', 'rewards', 'withdraws'] as const;
type Kind = (typeof KINDS)[number];
const PAGE_SIZE = 10;

export function AffiliateDetailDialog({
  affiliate,
  onClose,
}: {
  affiliate: AffiliateRow | null;
  onClose: () => void;
}) {
  const userId = affiliate?.userId;
  const [kind, setKind] = useState<Kind>('invites');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');

  // Start fresh for each affiliate opened.
  useEffect(() => {
    setKind('invites');
    setPage(1);
    setSearch('');
    setDebounced('');
  }, [userId]);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [kind, debounced]);

  const summaryQuery = useQuery({
    queryKey: ['admin-affiliate-detail', userId, 'summary'],
    queryFn: () =>
      apiGet<DetailSummary>(
        `/api/admin/affiliates/detail?${new URLSearchParams({
          userId: userId!,
          kind: 'summary',
        })}`
      ),
    enabled: !!userId,
  });

  const listQuery = useQuery({
    queryKey: ['admin-affiliate-detail', userId, kind, page, debounced],
    queryFn: () => {
      const params = new URLSearchParams({
        userId: userId!,
        kind,
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (debounced) params.set('search', debounced);
      return apiGet<PageResult<any>>(`/api/admin/affiliates/detail?${params}`);
    },
    enabled: !!userId,
    // Keep the previous page while paging, but never show one tab's rows
    // under another tab's columns.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === userId &&
      previousQuery?.queryKey[2] === kind
        ? keepPreviousData(previous)
        : undefined,
  });

  const summary = summaryQuery.data;
  const info = summary?.affiliate ?? affiliate;

  const cards = [
    {
      label: m['admin.affiliates.detail.invite_total'](),
      value: String(summary?.inviteTotal ?? 0),
    },
    {
      label: m['admin.affiliates.detail.reward_earned'](),
      value: formatAmounts(summary?.rewardAmounts),
    },
    {
      label: m['admin.affiliates.detail.reward_withdrawn'](),
      value: formatAmounts(summary?.withdrawAmounts),
    },
    {
      label: m['admin.affiliates.detail.reward_balance'](),
      value: formatAmounts(summary?.rewardBalances),
      highlight: true,
    },
    ...(summary?.pendingBalances?.length
      ? [
          {
            label: m['admin.affiliates.detail.reward_held'](),
            value: formatAmounts(summary.pendingBalances),
          },
        ]
      : []),
  ];

  const inviteColumns: Column<DetailInvite>[] = [
    {
      header: m['admin.affiliates.fields.invite_time'](),
      cell: (r) => <DateCell value={r.createdAt} />,
    },
    {
      header: m['admin.affiliates.fields.invitee'](),
      cell: (r) => (
        <PlainUser name={r.invitedUserName} image={r.invitedUserAvatar} />
      ),
    },
    {
      header: m['admin.affiliates.fields.invite_code'](),
      cell: (r) => <span className="font-mono text-xs">{r.inviteCode}</span>,
    },
    {
      header: m['admin.affiliates.fields.paid_status'](),
      cell: (r) => <PaidBadge paid={r.paid} />,
    },
    {
      header: m['admin.affiliates.fields.first_paid_amount'](),
      className: 'text-right',
      cell: (r) => (
        <MoneyText amount={r.firstPaidAmount} currency={r.firstPaidCurrency} />
      ),
    },
  ];

  const rewardColumns: Column<DetailReward>[] = [
    {
      header: m['admin.affiliates.fields.reward_time'](),
      cell: (r) => <DateCell value={r.createdAt} />,
    },
    {
      header: m['admin.affiliates.fields.order_no'](),
      cell: (r) => (
        <span className="font-mono text-xs">{r.orderNo || '—'}</span>
      ),
    },
    {
      header: m['admin.affiliates.fields.reward_type'](),
      cell: (r) => <RewardTypeBadge type={r.rewardType} />,
    },
    {
      header: m['admin.affiliates.fields.reward_amount'](),
      className: 'text-right',
      cell: (r) => <RewardValue reward={r} />,
    },
    {
      header: m['admin.affiliates.fields.status'](),
      cell: (r) => <RewardStatusBadge status={r.status} />,
    },
    {
      header: m['admin.affiliates.fields.paid_user'](),
      cell: (r) => <PlainUser name={r.paidUserName} image={r.paidUserAvatar} />,
    },
    {
      header: m['admin.affiliates.fields.paid_amount'](),
      className: 'text-right',
      cell: (r) => (
        <MoneyText amount={r.paidAmount} currency={r.paidCurrency} />
      ),
    },
  ];

  const withdrawColumns: Column<DetailWithdraw>[] = [
    {
      header: m['admin.affiliates.fields.created_at'](),
      cell: (r) => <DateCell value={r.createdAt} />,
    },
    {
      header: m['admin.affiliates.fields.withdraw_no'](),
      cell: (r) => <span className="font-mono text-xs">{r.transactionNo}</span>,
    },
    {
      header: m['admin.affiliates.fields.amount'](),
      className: 'text-right',
      cell: (r) => (
        <MoneyText amount={r.amount} currency={r.currency} tone="positive" />
      ),
    },
    {
      header: m['admin.affiliates.fields.status'](),
      cell: (r) => <WithdrawStatusBadge status={r.status} />,
    },
    {
      header: m['admin.affiliates.fields.remark'](),
      cell: (r) => r.remark || '—',
    },
  ];

  const columns = (
    kind === 'invites'
      ? inviteColumns
      : kind === 'rewards'
        ? rewardColumns
        : withdrawColumns
  ) as Column<any>[];

  return (
    <Dialog open={!!affiliate} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{m['admin.affiliates.detail.title']()}</DialogTitle>
          <DialogDescription>
            {affiliate?.userName
              ? `${affiliate.userName} · ${affiliate.userEmail ?? ''}`
              : (affiliate?.userEmail ?? '')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <AffiliateStatusBadge status={info?.status} />
          {info && (
            <span className="text-muted-foreground">
              {m['admin.affiliates.fields.commission_percent']()}:{' '}
              {info.effectiveCommissionPercent ?? '—'}%
              {info.commissionPercent > 0
                ? ` (${m['admin.affiliates.commission_custom']()})`
                : ` (${m['admin.affiliates.commission_global']()})`}
            </span>
          )}
          {summary?.hasPendingWithdraw && (
            <Badge variant="secondary">
              {m['admin.affiliates.detail.pending_withdraw']()}
            </Badge>
          )}
        </div>

        <div
          className={cn(
            'grid grid-cols-2 gap-3',
            cards.length > 4 ? 'sm:grid-cols-5' : 'sm:grid-cols-4'
          )}
        >
          {cards.map((c) => (
            <div key={c.label} className="rounded-lg border p-3">
              <p className="text-muted-foreground text-xs">{c.label}</p>
              <p
                className={cn(
                  'mt-1 text-sm font-semibold break-words',
                  c.highlight && 'text-emerald-700 dark:text-emerald-400'
                )}
              >
                {c.value}
              </p>
            </div>
          ))}
        </div>

        <div className="grid gap-3">
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground mb-2 text-xs">
              {m['admin.affiliates.fields.invite_codes']()}
            </p>
            {summary?.inviteCodes.length ? (
              <ul className="space-y-1 text-sm">
                {summary.inviteCodes.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs">{c.code}</span>
                    {c.isDefault && (
                      <Badge variant="secondary">
                        {m['admin.affiliates.default_badge']()}
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">—</p>
            )}
          </div>
        </div>

        {info?.applyReason ? (
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">
              {m['admin.affiliates.fields.apply_reason']()}
            </p>
            <p className="bg-muted/50 rounded-md border px-3 py-2 text-sm whitespace-pre-wrap">
              {info.applyReason}
            </p>
          </div>
        ) : null}

        <TabStrip
          tabs={KINDS}
          value={kind}
          onChange={setKind}
          label={(k) => tDynamic(`admin.affiliates.detail.tab_${k}`)}
        />

        <DataTable
          columns={columns}
          data={listQuery.data?.items ?? []}
          total={listQuery.data?.total ?? 0}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          rowKey={(r) => String(r.id)}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={tDynamic(`admin.affiliates.detail.search_${kind}`)}
          emptyText={m['admin.affiliates.empty']()}
          loading={listQuery.isFetching}
          onRefresh={() => {
            summaryQuery.refetch();
            return listQuery.refetch();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
