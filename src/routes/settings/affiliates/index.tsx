import { useEffect, useState } from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Copy, Handshake, Hourglass, Link2, Wallet } from 'lucide-react';
import { toast } from 'sonner';

import { Link } from '@/core/i18n/navigation';
import type { AffiliateRewardRule } from '@/config/affiliates';
import { apiGet, apiPost } from '@/lib/api-client';
import { formatDateTime } from '@/lib/time';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { rewardHeadline, rewardSummary } from '@/blocks/affiliate-reward-rule';
import { DataTable, type Column } from '@/components/data-table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

import { FeatureGate } from '../-feature-gate';
import {
  affiliateErrorMessage,
  copyText,
  formatAmounts,
  formatMoney,
  inviteLinkOf,
  type CurrencyAmount,
} from './-shared';

const TABS = ['invite', 'reward', 'withdraw'] as const;
type Tab = (typeof TABS)[number];

const PAGE_SIZE = 10;

type AffiliateUser = {
  status: 'pending' | 'active' | 'rejected' | string;
  approved: boolean;
  applyReason?: string | null;
  /** This affiliate's rate (their own or the global one). */
  commissionPercent: number;
  inviteCode: string | null;
  inviteCodeCount: number;
};

type RewardDetail = {
  inviteTotal: number;
  rewardTotal: number;
  rewardAmounts: CurrencyAmount[];
  withdrawAmounts: CurrencyAmount[];
  rewardBalances: CurrencyAmount[];
  pendingBalances: CurrencyAmount[];
  nextAvailableAt: string | null;
  minWithdraw: CurrencyAmount[];
  hasPendingWithdraw: boolean;
};

type InviteRow = {
  id: string;
  inviteCode: string | null;
  createdAt: string;
  invitedUserName: string | null;
  invitedUserAvatar: string | null;
  paid: boolean;
  firstPaidAmount: number | null;
  firstPaidCurrency: string | null;
};

type RewardRow = {
  id: string;
  transactionNo: string;
  orderNo: string | null;
  rewardType: 'cash' | 'manual' | string;
  rewardAmount: number;
  rewardCurrency: string | null;
  rewardPercent: number | null;
  status: string;
  availableAt: string | null;
  createdAt: string;
  paidAmount: number | null;
  paidCurrency: string | null;
  productName: string | null;
  paidUserName: string | null;
  paidUserAvatar: string | null;
};

type WithdrawRow = {
  id: string;
  transactionNo: string;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  remark: string | null;
  createdAt: string;
};

type DashboardResponse = {
  items: unknown[];
  total: number;
  rewardDetail: RewardDetail | null;
  rewardRule: AffiliateRewardRule;
  affiliateUser: AffiliateUser | null;
};

function statusLabel(status: string) {
  switch (status) {
    case 'active':
      return m['affiliates.status.active']();
    case 'revoked':
      return m['affiliates.status.revoked']();
    case 'pending':
      return m['affiliates.status.pending']();
    case 'success':
      return m['affiliates.status.success']();
    case 'rejected':
      return m['affiliates.status.rejected']();
    default:
      return status;
  }
}

function statusVariant(
  status: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'active' || status === 'success') return 'default';
  if (status === 'revoked' || status === 'rejected') return 'destructive';
  return 'secondary';
}

function tabLabel(tab: Tab) {
  if (tab === 'reward') return m['affiliates.tabs.reward']();
  if (tab === 'withdraw') return m['affiliates.tabs.withdraw']();
  return m['affiliates.tabs.invite']();
}

function PersonCell({
  name,
  image,
}: {
  name: string | null;
  image: string | null;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Avatar className="size-7">
        <AvatarImage src={image || undefined} />
        <AvatarFallback className="text-xs">
          {(name || '?').charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="truncate text-sm">{name || '—'}</span>
    </div>
  );
}

function AffiliatesPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('invite');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [tab, debouncedSearch, status]);

  const query = useQuery({
    queryKey: ['affiliates', tab, page, debouncedSearch, status],
    queryFn: () => {
      const params = new URLSearchParams({ tab, page: String(page) });
      if (debouncedSearch) params.set('keyword', debouncedSearch);
      if (status !== 'all') params.set('status', status);
      return apiGet<DashboardResponse>(`/api/affiliates?${params}`);
    },
    placeholderData: keepPreviousData,
  });

  const affiliate = query.data?.affiliateUser ?? null;
  const reward = query.data?.rewardDetail ?? null;

  if (query.isPending) {
    return <div className="text-muted-foreground p-6">…</div>;
  }

  // A failed request leaves `affiliate` null, which would otherwise show the
  // application form to an approved affiliate.
  if (query.isError) {
    return (
      <div className="space-y-3 p-6">
        <p className="text-muted-foreground text-sm">
          {affiliateErrorMessage(query.error?.message ?? '')}
        </p>
        <Button variant="outline" onClick={() => query.refetch()}>
          {m['common.error.retry']()}
        </Button>
      </div>
    );
  }

  const header = (
    <div>
      <h1 className="text-2xl font-bold">{m['affiliates.title']()}</h1>
      <p className="text-muted-foreground">{m['affiliates.description']()}</p>
    </div>
  );

  if (!affiliate?.approved) {
    return (
      <div className="space-y-6 p-6">
        {header}
        <ApplyCard
          status={affiliate?.status ?? null}
          onApplied={() =>
            queryClient.invalidateQueries({ queryKey: ['affiliates'] })
          }
        />
      </div>
    );
  }

  const rule = query.data?.rewardRule ?? null;
  const inviteLink = affiliate.inviteCode
    ? inviteLinkOf(affiliate.inviteCode, rule?.inviteParam)
    : '';
  const minWithdraw = reward?.minWithdraw ?? [];
  const balances = reward?.rewardBalances ?? [];
  const withdrawable = balances.some(
    (b) =>
      b.amount >=
      (minWithdraw.find((x) => x.currency === b.currency)?.amount ?? Infinity)
  );
  const canWithdraw = withdrawable && !reward?.hasPendingWithdraw;

  const statusOptions =
    tab === 'reward'
      ? ['active', 'revoked']
      : tab === 'withdraw'
        ? ['pending', 'success', 'rejected']
        : [];

  return (
    <div className="space-y-6 p-6">
      {header}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Main invite link. */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>{m['affiliates.link.card_title']()}</CardTitle>
              <Link
                href="/settings/affiliates/links"
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'sm' }),
                  'gap-1.5'
                )}
              >
                <Link2 className="size-3.5" />
                {m['affiliates.link.manage']()}
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {affiliate.inviteCode ? (
              <div className="bg-muted/50 flex items-center gap-2 rounded-md border px-3 py-2">
                <span className="min-w-0 flex-1 truncate font-mono text-sm">
                  {inviteLink}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5"
                  onClick={() =>
                    copyText(inviteLink, m['affiliates.link.copied']())
                  }
                >
                  <Copy className="size-3.5" />
                  {m['affiliates.link.copy']()}
                </Button>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                {m['affiliates.link.empty']()}
              </p>
            )}
            {affiliate.inviteCode ? (
              <p className="text-muted-foreground text-xs">
                {m['affiliates.link.any_page']({
                  param: `?${rule?.inviteParam ?? 'ref'}=${affiliate.inviteCode}`,
                })}
              </p>
            ) : null}
            {affiliate.inviteCodeCount > 1 ? (
              <p className="text-muted-foreground text-xs">
                {m['affiliates.link.count']({
                  count: affiliate.inviteCodeCount,
                })}
              </p>
            ) : null}
          </CardContent>
        </Card>

        {/* How you earn: the admin's reward rule, in words. */}
        <Card>
          <CardHeader>
            <CardTitle>{m['affiliates.rule.card_title']()}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {rule ? (
              <>
                <p className="text-primary text-2xl font-bold">
                  {rewardHeadline(rule, affiliate.commissionPercent)}
                </p>
                <p className="text-muted-foreground text-sm">
                  {rewardSummary(rule, affiliate.commissionPercent)}
                </p>
                <p className="text-muted-foreground text-xs">
                  {[m['affiliates.rule.attribution']()]
                    .filter(Boolean)
                    .join(' ')}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">—</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>{m['affiliates.earnings.card_title']()}</CardTitle>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={!canWithdraw}
                onClick={() => setWithdrawOpen(true)}
              >
                <Wallet className="size-3.5" />
                {m['affiliates.withdraw.button']()}
              </Button>
            </div>
            <CardDescription>
              {m['affiliates.earnings.balance_label']()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-primary text-2xl font-bold">
              {formatAmounts(balances)}
            </p>
            {reward?.pendingBalances?.length ? (
              <p className="text-muted-foreground text-sm">
                {m['affiliates.earnings.pending']({
                  amount: formatAmounts(reward.pendingBalances),
                  date: reward.nextAvailableAt
                    ? new Date(reward.nextAvailableAt).toLocaleDateString()
                    : '—',
                })}
              </p>
            ) : null}
            <p className="text-muted-foreground text-sm">
              {m['affiliates.earnings.detail']({
                invites: reward?.inviteTotal ?? 0,
                rewards: reward?.rewardTotal ?? 0,
                earned: formatAmounts(reward?.rewardAmounts),
                withdrawn: formatAmounts(reward?.withdrawAmounts),
              })}
            </p>
            <p className="text-muted-foreground text-xs">
              {reward?.hasPendingWithdraw
                ? m['affiliates.withdraw.pending_tip']()
                : balances.length && !withdrawable
                  ? m['affiliates.withdraw.min_tip']({
                      min: formatAmounts(minWithdraw),
                    })
                  : rule?.holdDays
                    ? m['affiliates.earnings.hold_tip']({ days: rule.holdDays })
                    : m['affiliates.earnings.commission_tip']()}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="border-border flex gap-1 overflow-x-auto overflow-y-hidden border-b">
        {TABS.map((tb) => (
          <button
            key={tb}
            onClick={() => {
              setTab(tb);
              setStatus('all');
              setSearch('');
            }}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors',
              tab === tb
                ? 'border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground border-transparent'
            )}
          >
            {tabLabel(tb)}
          </button>
        ))}
      </div>

      <Card>
        <CardContent>
          <DataTable<any>
            columns={buildColumns(tab)}
            data={query.data?.items ?? []}
            total={query.data?.total ?? 0}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            rowKey={(row) => row.id}
            emptyText={m['affiliates.table.empty']()}
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder={
              tab === 'invite'
                ? m['affiliates.table.search_invite']()
                : m['affiliates.table.search_no']()
            }
            toolbar={
              statusOptions.length ? (
                <Select
                  value={status}
                  onValueChange={(value) => setStatus(value || 'all')}
                >
                  <SelectTrigger className="h-9 w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {m['affiliates.status.all']()}
                    </SelectItem>
                    {statusOptions.map((st) => (
                      <SelectItem key={st} value={st}>
                        {statusLabel(st)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : undefined
            }
            onRefresh={() => query.refetch()}
            loading={query.isFetching}
          />
        </CardContent>
      </Card>

      <WithdrawDialog
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        balances={balances}
        minWithdraw={minWithdraw}
        onDone={() => {
          setTab('withdraw');
          setStatus('all');
          queryClient.invalidateQueries({ queryKey: ['affiliates'] });
        }}
      />
    </div>
  );
}

function ApplyCard({
  status,
  onApplied,
}: {
  status: string | null;
  onApplied: () => void;
}) {
  const [reason, setReason] = useState('');
  const pending = status === 'pending';
  const rejected = status === 'rejected';

  const mutation = useMutation({
    mutationFn: (value: string) =>
      apiPost<{ ok: boolean; status: string }>('/api/affiliates/apply', {
        reason: value,
      }),
    onSuccess: (data) => {
      toast.success(
        data?.status === 'active'
          ? m['affiliates.apply.approved']()
          : m['affiliates.apply.submitted']()
      );
      setReason('');
      onApplied();
    },
    onError: (e: Error) => toast.error(affiliateErrorMessage(e.message)),
  });

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {pending ? (
            <Hourglass className="text-muted-foreground size-5" />
          ) : (
            <Handshake className="text-muted-foreground size-5" />
          )}
          {pending
            ? m['affiliates.apply.pending_title']()
            : rejected
              ? m['affiliates.apply.rejected_title']()
              : m['affiliates.apply.title']()}
        </CardTitle>
        <CardDescription>
          {pending
            ? m['affiliates.apply.pending_tip']()
            : rejected
              ? m['affiliates.apply.rejected_tip']()
              : m['affiliates.apply.description']()}
        </CardDescription>
      </CardHeader>
      {!pending ? (
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const value = reason.trim();
              if (!value) {
                toast.error(m['affiliates.errors.reason_required']());
                return;
              }
              mutation.mutate(value);
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="affiliate-reason">
                {m['affiliates.apply.reason_label']()}
              </Label>
              <Textarea
                id="affiliate-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                maxLength={1000}
                placeholder={m['affiliates.apply.reason_placeholder']()}
              />
            </div>
            <Button
              type="submit"
              disabled={mutation.isPending || !reason.trim()}
              className="gap-2"
            >
              <Handshake className="size-4" />
              {mutation.isPending
                ? '…'
                : rejected
                  ? m['affiliates.apply.reapply']()
                  : m['affiliates.apply.submit']()}
            </Button>
          </form>
        </CardContent>
      ) : null}
    </Card>
  );
}

function WithdrawDialog({
  open,
  onOpenChange,
  balances,
  minWithdraw,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  balances: CurrencyAmount[];
  minWithdraw: CurrencyAmount[];
  onDone: () => void;
}) {
  const [description, setDescription] = useState('');
  // Only balances at or above their currency's minimum are paid out.
  const eligible = balances.filter(
    (b) =>
      b.amount >=
      (minWithdraw.find((x) => x.currency === b.currency)?.amount ?? Infinity)
  );

  const mutation = useMutation({
    mutationFn: (value: string) =>
      apiPost('/api/affiliates/withdraw', { description: value }),
    onSuccess: () => {
      toast.success(m['affiliates.withdraw.submitted']());
      setDescription('');
      onOpenChange(false);
      onDone();
    },
    onError: (e: Error) => toast.error(affiliateErrorMessage(e.message)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const value = description.trim();
            if (!value) return;
            mutation.mutate(value);
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>{m['affiliates.withdraw.title']()}</DialogTitle>
            <DialogDescription>
              {m['affiliates.withdraw.amount_tip']({
                amount: formatAmounts(eligible),
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="affiliate-payout">
              {m['affiliates.withdraw.account_label']()}
            </Label>
            <Textarea
              id="affiliate-payout"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder={m['affiliates.withdraw.account_placeholder']()}
            />
            <p className="text-muted-foreground text-xs">
              {m['affiliates.withdraw.account_tip']()}
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {m['affiliates.cancel']()}
            </Button>
            <Button
              type="submit"
              disabled={
                mutation.isPending || !description.trim() || !eligible.length
              }
            >
              {mutation.isPending ? '…' : m['affiliates.withdraw.submit']()}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function buildColumns(tab: Tab): Column<any>[] {
  const timeCell = (value: string) => (
    <span className="text-muted-foreground text-sm whitespace-nowrap">
      {formatDateTime(value)}
    </span>
  );
  const statusCell = (value: string) => (
    <Badge variant={statusVariant(value)}>{statusLabel(value)}</Badge>
  );

  if (tab === 'reward') {
    const columns: Column<RewardRow>[] = [
      {
        header: m['affiliates.table.reward_no'](),
        cell: (r) => (
          <span className="font-mono text-xs">{r.transactionNo}</span>
        ),
      },
      {
        header: m['affiliates.table.buyer'](),
        cell: (r) => (
          <PersonCell name={r.paidUserName} image={r.paidUserAvatar} />
        ),
      },
      {
        header: m['affiliates.table.product'](),
        cell: (r) => r.productName || '—',
      },
      {
        header: m['affiliates.table.paid_amount'](),
        cell: (r) =>
          r.paidAmount != null
            ? formatMoney(r.paidAmount, r.paidCurrency || 'USD')
            : '—',
      },
      {
        header: m['affiliates.table.commission'](),
        cell: (r) => (
          <span className="font-medium whitespace-nowrap">
            {formatMoney(r.rewardAmount, r.rewardCurrency || 'USD')}
            {r.rewardPercent ? (
              <span className="text-muted-foreground ml-1 text-xs">
                ({r.rewardPercent}%)
              </span>
            ) : null}
          </span>
        ),
      },
      {
        header: m['affiliates.table.status'](),
        cell: (r) =>
          r.status === 'active' &&
          r.availableAt &&
          new Date(r.availableAt).getTime() > Date.now() ? (
            <Badge variant="outline" className="whitespace-nowrap">
              {m['affiliates.status.held']({
                date: new Date(r.availableAt).toLocaleDateString(),
              })}
            </Badge>
          ) : (
            statusCell(r.status)
          ),
      },
      {
        header: m['affiliates.table.reward_time'](),
        cell: (r) => timeCell(r.createdAt),
      },
    ];
    return columns as Column<any>[];
  }

  if (tab === 'withdraw') {
    const columns: Column<WithdrawRow>[] = [
      {
        header: m['affiliates.table.withdraw_no'](),
        cell: (r) => (
          <span className="font-mono text-xs">{r.transactionNo}</span>
        ),
      },
      {
        header: m['affiliates.table.amount'](),
        cell: (r) => (
          <span className="font-medium">
            {formatMoney(r.amount, r.currency)}
          </span>
        ),
      },
      {
        header: m['affiliates.table.status'](),
        cell: (r) => statusCell(r.status),
      },
      {
        header: m['affiliates.table.payout_account'](),
        cell: (r) => (
          <span className="line-clamp-2 max-w-[240px] text-sm break-all">
            {r.description || '—'}
          </span>
        ),
      },
      {
        header: m['affiliates.table.remark'](),
        cell: (r) => (
          <span className="line-clamp-2 max-w-[200px] text-sm">
            {r.remark || '—'}
          </span>
        ),
      },
      {
        header: m['affiliates.table.created_at'](),
        cell: (r) => timeCell(r.createdAt),
      },
    ];
    return columns as Column<any>[];
  }

  const columns: Column<InviteRow>[] = [
    {
      header: m['affiliates.table.invited_user'](),
      cell: (r) => (
        <PersonCell name={r.invitedUserName} image={r.invitedUserAvatar} />
      ),
    },
    {
      header: m['affiliates.table.invite_code'](),
      cell: (r) => (
        <span className="font-mono text-xs">{r.inviteCode || '—'}</span>
      ),
    },
    {
      header: m['affiliates.table.paid_status'](),
      cell: (r) =>
        r.paid ? (
          <Badge>{m['affiliates.status.paid']()}</Badge>
        ) : (
          <Badge variant="secondary">{m['affiliates.status.unpaid']()}</Badge>
        ),
    },
    {
      header: m['affiliates.table.first_paid_amount'](),
      cell: (r) =>
        r.firstPaidAmount != null
          ? formatMoney(r.firstPaidAmount, r.firstPaidCurrency || 'USD')
          : '—',
    },
    {
      header: m['affiliates.table.invite_time'](),
      cell: (r) => timeCell(r.createdAt),
    },
  ];
  return columns as Column<any>[];
}

export const Route = createFileRoute('/settings/affiliates/')({
  component: () => (
    <FeatureGate feature="affiliates">
      <AffiliatesPage />
    </FeatureGate>
  ),
});
