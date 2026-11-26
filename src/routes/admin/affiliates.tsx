import { useEffect, useState } from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Check, Eye, Gift, Pencil, Wallet } from 'lucide-react';
import { toast } from 'sonner';

import { tDynamic } from '@/core/i18n/dynamic';
import { apiGet, apiPost, apiPut, type PageResult } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { useConfirm } from '@/hooks/use-confirm';
import { DataTable, type Column } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { UserCell } from '@/components/user-cell';

import {
  AffiliateDetailDialog,
  type AffiliateRow,
} from './-affiliate-detail-dialog';
import { AffiliateSettings } from './-affiliate-settings';
import {
  AFFILIATE_STATUSES,
  affiliateErrorMessage,
  AffiliateStatusBadge,
  currencyDigits,
  DateCell,
  formatMoney,
  MoneyText,
  PaidBadge,
  PlainUser,
  REWARD_STATUSES,
  REWARD_TYPES,
  RewardStatusBadge,
  RewardTypeBadge,
  RewardValue,
  TabStrip,
  useAffiliatePermissions,
  WITHDRAW_STATUSES,
  WithdrawStatusBadge,
} from './-affiliate-shared';
import { AffiliateStatistics } from './-affiliate-statistics';

const PAGE_SIZE = 20;
const TABS = [
  'affiliates',
  'referrals',
  'rewards',
  'withdrawals',
  'statistics',
  'settings',
] as const;
type Tab = (typeof TABS)[number];
/** Tabs that render something other than a list. */
type ListTab = Exclude<Tab, 'statistics' | 'settings'>;

interface ReferralRow {
  id: string;
  inviteCode: string;
  createdAt: string;
  inviterUserId: string;
  inviterName: string | null;
  inviterEmail: string | null;
  inviterAvatar: string | null;
  inviteeUserId: string;
  inviteeName: string | null;
  inviteeEmail: string | null;
  inviteeAvatar: string | null;
  paid: boolean;
  orderNo: string | null;
  firstPaidAmount: number | null;
  firstPaidCurrency: string | null;
  hasReward: boolean;
  rewardAmount: number | null;
  rewardCurrency: string | null;
  rewardStatus: string | null;
}

interface RewardRow {
  id: string;
  transactionNo: string;
  userId: string;
  orderNo: string;
  rewardType: string;
  rewardPercent: number;
  rewardAmount: number;
  rewardCurrency: string;
  status: string;
  createdAt: string;
  affiliateName: string | null;
  affiliateEmail: string | null;
  affiliateAvatar: string | null;
  paidAmount: number | null;
  paidCurrency: string | null;
  productName: string | null;
  paidUserName: string | null;
  paidUserEmail: string | null;
  paidUserAvatar: string | null;
}

interface WithdrawRow {
  id: string;
  transactionNo: string;
  userId: string;
  amount: number;
  currency: string;
  status: string;
  description: string;
  remark: string;
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
  userAvatar: string | null;
}

const ENDPOINTS: Record<ListTab, string> = {
  affiliates: '/api/admin/affiliates',
  referrals: '/api/admin/affiliates/invites',
  rewards: '/api/admin/affiliates/rewards',
  withdrawals: '/api/admin/affiliates/withdraws',
};

function AffiliatesAdminPage() {
  const queryClient = useQueryClient();
  const navigate = Route.useNavigate();
  const tabParam = Route.useSearch().tab;
  const tab: Tab = TABS.includes(tabParam as Tab)
    ? (tabParam as Tab)
    : 'affiliates';
  const {
    canWrite,
    canReward,
    canWithdraw,
    canReadSettings,
    canWriteSettings,
  } = useAffiliatePermissions();
  const tabs = TABS.filter((t) => t !== 'settings' || canReadSettings);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  // Up to two filters per tab; their meaning depends on the tab (see
  // listParams).
  const [filterA, setFilterA] = useState('all');
  const [filterB, setFilterB] = useState('all');

  const [detail, setDetail] = useState<AffiliateRow | null>(null);
  const [editing, setEditing] = useState<AffiliateRow | null>(null);
  const [editForm, setEditForm] = useState({
    status: 'pending',
    // Own cash commission %; empty or 0 = the global setting.
    commissionPercent: '',
  });
  const [rewarding, setRewarding] = useState<ReferralRow | null>(null);
  const [rewardForm, setRewardForm] = useState({
    rewardType: 'fixed' as 'fixed' | 'percent',
    amount: '',
    percent: '',
  });
  const [processing, setProcessing] = useState<WithdrawRow | null>(null);
  const [remark, setRemark] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => {
    setSearch('');
    setDebounced('');
    setFilterA('all');
    setFilterB('all');
  }, [tab]);
  useEffect(() => setPage(1), [tab, debounced, filterA, filterB]);

  function setTab(next: Tab) {
    navigate({
      search: next === 'affiliates' ? {} : { tab: next },
      replace: true,
    });
  }

  function listParams() {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    if (debounced) params.set('search', debounced);
    const set = (key: string, value: string) => {
      if (value !== 'all') params.set(key, value);
    };
    if (tab === 'affiliates') {
      set('status', filterA);
    } else if (tab === 'referrals') {
      set('status', filterA);
    } else if (tab === 'rewards') {
      set('rewardType', filterA);
      set('status', filterB);
    } else {
      set('status', filterA);
    }
    return params;
  }

  const listQuery = useQuery({
    queryKey: ['admin-affiliates', tab, page, debounced, filterA, filterB],
    queryFn: () =>
      apiGet<PageResult<any>>(`${ENDPOINTS[tab as ListTab]}?${listParams()}`),
    enabled: tab in ENDPOINTS,
    // Keep the previous page while paging, never another tab's rows.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === tab
        ? keepPreviousData(previous)
        : undefined,
  });

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-affiliates'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-affiliate-detail'] }),
      queryClient.invalidateQueries({
        queryKey: ['admin-affiliate-statistics'],
      }),
    ]);

  // ─── Mutations ─────────────────────────────────────────────────────────────

  const updateAffiliate = useMutation({
    mutationFn: (body: {
      id: string;
      status?: string;
      commissionPercent?: number;
    }) => apiPut('/api/admin/affiliates', body),
    onSuccess: () => {
      toast.success(m['admin.affiliates.toasts.saved']());
      setEditing(null);
      invalidate();
    },
    onError: (e) => toast.error(affiliateErrorMessage(e)),
  });

  const createReward = useMutation({
    mutationFn: (body: {
      inviteId: string;
      rewardType: 'fixed' | 'percent';
      amount?: number;
      percent?: number;
    }) => apiPost('/api/admin/affiliates/rewards', body),
    onSuccess: () => {
      toast.success(m['admin.affiliates.toasts.reward_created']());
      setRewarding(null);
      invalidate();
    },
    onError: (e) => toast.error(affiliateErrorMessage(e)),
  });

  const updateWithdraw = useMutation({
    mutationFn: (body: {
      id: string;
      status?: 'success' | 'rejected';
      remark?: string;
    }) => apiPut('/api/admin/affiliates/withdraws', body),
    onSuccess: (_, body) => {
      toast.success(
        body.status === 'success'
          ? m['admin.affiliates.toasts.withdraw_paid']()
          : body.status === 'rejected'
            ? m['admin.affiliates.toasts.withdraw_rejected']()
            : m['admin.affiliates.toasts.saved']()
      );
      setProcessing(null);
      invalidate();
    },
    onError: (e) => {
      toast.error(affiliateErrorMessage(e));
      invalidate();
    },
  });

  // ─── Affiliates ────────────────────────────────────────────────────────────

  function openEdit(row: AffiliateRow) {
    setEditForm({
      status: row.status,
      commissionPercent: row.commissionPercent
        ? String(row.commissionPercent)
        : '',
    });
    setEditing(row);
  }

  function saveEdit() {
    if (!editing) return;
    const percent = Number(editForm.commissionPercent.trim() || 0);
    if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
      toast.error(m['admin.affiliates.errors.invalid_percent']());
      return;
    }
    updateAffiliate.mutate({
      id: editing.id,
      status: editForm.status,
      commissionPercent: percent,
    });
  }

  async function approve(row: AffiliateRow) {
    const ok = await confirm({
      title: m['admin.affiliates.approve_title'](),
      description: m['admin.affiliates.approve_description']({
        user: row.userEmail || row.userName || row.userId,
      }),
      confirmLabel: m['admin.affiliates.buttons.approve'](),
    });
    if (ok) updateAffiliate.mutate({ id: row.id, status: 'active' });
  }

  // ─── Rewards ───────────────────────────────────────────────────────────────

  function openReward(row: ReferralRow) {
    setRewardForm({ rewardType: 'fixed', amount: '', percent: '' });
    setRewarding(row);
  }

  const rewardCurrency = (rewarding?.firstPaidCurrency || 'USD').toUpperCase();
  const rewardPaid = rewarding?.firstPaidAmount ?? 0;
  const rewardMinor =
    rewardForm.rewardType === 'percent'
      ? Math.floor(
          (rewardPaid * Math.floor(Number(rewardForm.percent) || 0)) / 100
        )
      : Math.round(
          (Number(rewardForm.amount) || 0) *
            10 ** currencyDigits(rewardCurrency)
        );

  function saveReward() {
    if (!rewarding) return;
    if (rewardForm.rewardType === 'percent') {
      const percent = Number(rewardForm.percent);
      if (!Number.isInteger(percent) || percent < 1 || percent > 100) {
        toast.error(m['admin.affiliates.errors.invalid_amount']());
        return;
      }
      createReward.mutate({
        inviteId: rewarding.id,
        rewardType: 'percent',
        percent,
      });
      return;
    }
    if (!(rewardMinor > 0) || (rewardPaid > 0 && rewardMinor > rewardPaid)) {
      toast.error(m['admin.affiliates.errors.invalid_amount']());
      return;
    }
    createReward.mutate({
      inviteId: rewarding.id,
      rewardType: 'fixed',
      amount: rewardMinor,
    });
  }

  // ─── Withdrawals ───────────────────────────────────────────────────────────

  function openProcess(row: WithdrawRow) {
    setRemark(row.remark || '');
    setProcessing(row);
  }

  async function settle(status: 'success' | 'rejected') {
    if (!processing) return;
    const amount = formatMoney(processing.amount, processing.currency);
    const ok = await confirm(
      status === 'success'
        ? {
            title: m['admin.affiliates.withdraw.confirm_paid_title'](),
            description: m['admin.affiliates.withdraw.confirm_paid']({
              amount,
            }),
            confirmLabel: m['admin.affiliates.withdraw.mark_paid'](),
          }
        : {
            title: m['admin.affiliates.withdraw.confirm_reject_title'](),
            description: m['admin.affiliates.withdraw.confirm_reject']({
              amount,
            }),
            confirmLabel: m['admin.affiliates.withdraw.reject'](),
            destructive: true,
          }
    );
    if (!ok) return;
    updateWithdraw.mutate({
      id: processing.id,
      status,
      remark: remark.trim(),
    });
  }

  // ─── Columns ───────────────────────────────────────────────────────────────

  const affiliateColumns: Column<AffiliateRow>[] = [
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
      header: m['admin.affiliates.fields.status'](),
      cell: (r) => <AffiliateStatusBadge status={r.status} />,
    },
    {
      header: m['admin.affiliates.fields.commission_percent'](),
      cell: (r) => (
        <span className="whitespace-nowrap tabular-nums">
          {r.effectiveCommissionPercent}%
          <span className="text-muted-foreground ml-1 text-xs">
            (
            {r.commissionPercent > 0
              ? m['admin.affiliates.commission_custom']()
              : m['admin.affiliates.commission_global']()}
            )
          </span>
        </span>
      ),
    },
    {
      header: m['admin.affiliates.fields.invite_codes'](),
      cell: (r) => (
        <CodeSummary
          codes={r.inviteCodes.map((c) => ({
            code: c.code,
            isDefault: c.isDefault,
          }))}
        />
      ),
    },
    {
      header: m['admin.affiliates.fields.created_at'](),
      cell: (r) => <DateCell value={r.createdAt} />,
    },
    {
      header: '',
      className: 'w-[120px]',
      cell: (r) => (
        <div className="flex items-center justify-end gap-1">
          {canWrite && r.status === 'pending' && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              title={m['admin.affiliates.buttons.approve']()}
              aria-label={m['admin.affiliates.buttons.approve']()}
              disabled={updateAffiliate.isPending}
              onClick={() => approve(r)}
            >
              <Check className="size-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            title={m['admin.affiliates.buttons.detail']()}
            aria-label={m['admin.affiliates.buttons.detail']()}
            onClick={() => setDetail(r)}
          >
            <Eye className="size-4" />
          </Button>
          {canWrite && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              title={m['admin.affiliates.buttons.edit']()}
              aria-label={m['admin.affiliates.buttons.edit']()}
              onClick={() => openEdit(r)}
            >
              <Pencil className="size-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const referralColumns: Column<ReferralRow>[] = [
    {
      header: m['admin.affiliates.fields.invite_time'](),
      cell: (r) => <DateCell value={r.createdAt} />,
    },
    {
      header: m['admin.affiliates.fields.inviter'](),
      cell: (r) => (
        <UserCell
          userId={r.inviterUserId}
          name={r.inviterName}
          email={r.inviterEmail}
          image={r.inviterAvatar}
        />
      ),
    },
    {
      header: m['admin.affiliates.fields.invitee'](),
      cell: (r) => (
        <UserCell
          userId={r.inviteeUserId}
          name={r.inviteeName}
          email={r.inviteeEmail}
          image={r.inviteeAvatar}
        />
      ),
    },
    {
      header: m['admin.affiliates.fields.invite_code'](),
      cell: (r) =>
        r.inviteCode ? (
          <span className="font-mono text-xs">{r.inviteCode}</span>
        ) : (
          '—'
        ),
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
    {
      header: m['admin.affiliates.fields.reward_amount'](),
      className: 'text-right',
      cell: (r) =>
        r.hasReward ? (
          <MoneyText
            amount={r.rewardAmount}
            currency={r.rewardCurrency}
            tone={r.rewardStatus === 'revoked' ? 'muted' : 'positive'}
            strike={r.rewardStatus === 'revoked'}
          />
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      header: '',
      className: 'w-[56px]',
      cell: (r) =>
        canReward && r.paid && !r.hasReward ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            title={m['admin.affiliates.buttons.create_reward']()}
            aria-label={m['admin.affiliates.buttons.create_reward']()}
            onClick={() => openReward(r)}
          >
            <Gift className="size-4" />
          </Button>
        ) : null,
    },
  ];

  const rewardColumns: Column<RewardRow>[] = [
    {
      header: m['admin.affiliates.fields.reward_time'](),
      cell: (r) => <DateCell value={r.createdAt} />,
    },
    {
      header: m['admin.affiliates.fields.affiliate'](),
      cell: (r) => (
        <UserCell
          userId={r.userId}
          name={r.affiliateName}
          email={r.affiliateEmail}
          image={r.affiliateAvatar}
        />
      ),
    },
    {
      header: m['admin.affiliates.fields.reward_type'](),
      cell: (r) => <RewardTypeBadge type={r.rewardType} />,
    },
    {
      header: m['admin.affiliates.fields.reward_amount'](),
      className: 'text-right',
      cell: (r) => (
        <div className="flex flex-col items-end">
          <RewardValue reward={r} />
          {r.rewardPercent > 0 && (
            <span className="text-muted-foreground text-xs">
              {r.rewardPercent}%
            </span>
          )}
        </div>
      ),
    },
    {
      header: m['admin.affiliates.fields.status'](),
      cell: (r) => <RewardStatusBadge status={r.status} />,
    },
    {
      header: m['admin.affiliates.fields.paid_user'](),
      cell: (r) => (
        <PlainUser
          name={r.paidUserName}
          email={r.paidUserEmail}
          image={r.paidUserAvatar}
        />
      ),
    },
    {
      header: m['admin.affiliates.fields.paid_amount'](),
      className: 'text-right',
      cell: (r) => (
        <div className="flex flex-col items-end">
          <MoneyText amount={r.paidAmount} currency={r.paidCurrency} />
          {r.productName && (
            <span className="text-muted-foreground max-w-[160px] truncate text-xs">
              {r.productName}
            </span>
          )}
        </div>
      ),
    },
    {
      header: m['admin.affiliates.fields.order_no'](),
      cell: (r) => (
        <span className="font-mono text-xs">{r.orderNo || '—'}</span>
      ),
    },
  ];

  const withdrawColumns: Column<WithdrawRow>[] = [
    {
      header: m['admin.affiliates.fields.created_at'](),
      cell: (r) => <DateCell value={r.createdAt} />,
    },
    {
      header: m['admin.affiliates.fields.withdraw_no'](),
      cell: (r) => <span className="font-mono text-xs">{r.transactionNo}</span>,
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
      header: m['admin.affiliates.fields.payout_details'](),
      cell: (r) => (
        <span
          className="block max-w-[220px] truncate text-sm"
          title={r.description}
        >
          {r.description || '—'}
        </span>
      ),
    },
    {
      header: m['admin.affiliates.fields.remark'](),
      cell: (r) => (
        <span className="block max-w-[180px] truncate text-sm" title={r.remark}>
          {r.remark || '—'}
        </span>
      ),
    },
    {
      header: '',
      className: 'w-[56px]',
      cell: (r) =>
        canWithdraw ? (
          <Button
            variant={r.status === 'pending' ? 'outline' : 'ghost'}
            size="icon"
            className="size-7"
            title={m['admin.affiliates.buttons.process']()}
            aria-label={m['admin.affiliates.buttons.process']()}
            onClick={() => openProcess(r)}
          >
            <Wallet className="size-4" />
          </Button>
        ) : null,
    },
  ];

  // ─── Filters ───────────────────────────────────────────────────────────────

  const filterSelect = (
    value: string,
    onChange: (v: string) => void,
    allLabel: string,
    options: { value: string; label: string }[]
  ) => (
    <Select value={value} onValueChange={(v) => onChange(v || 'all')}>
      <SelectTrigger className="h-8 w-[140px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const allStatuses = m['admin.affiliates.filters.all_statuses']();
  const toolbar =
    tab === 'affiliates' ? (
      filterSelect(
        filterA,
        setFilterA,
        allStatuses,
        AFFILIATE_STATUSES.map((s) => ({
          value: s,
          label: tDynamic(`admin.affiliates.status.${s}`),
        }))
      )
    ) : tab === 'referrals' ? (
      filterSelect(filterA, setFilterA, allStatuses, [
        { value: 'paid', label: m['admin.affiliates.paid.paid']() },
        { value: 'unpaid', label: m['admin.affiliates.paid.unpaid']() },
      ])
    ) : tab === 'rewards' ? (
      <>
        {filterSelect(
          filterA,
          setFilterA,
          m['admin.affiliates.filters.all_types'](),
          REWARD_TYPES.map((t) => ({
            value: t,
            label: tDynamic(`admin.affiliates.reward_type.${t}`),
          }))
        )}
        {filterSelect(
          filterB,
          setFilterB,
          allStatuses,
          REWARD_STATUSES.map((s) => ({
            value: s,
            label: tDynamic(`admin.affiliates.reward_status.${s}`),
          }))
        )}
      </>
    ) : (
      filterSelect(
        filterA,
        setFilterA,
        allStatuses,
        WITHDRAW_STATUSES.map((s) => ({
          value: s,
          label: tDynamic(`admin.affiliates.withdraw_status.${s}`),
        }))
      )
    );

  const columns = (
    tab === 'affiliates'
      ? affiliateColumns
      : tab === 'referrals'
        ? referralColumns
        : tab === 'rewards'
          ? rewardColumns
          : withdrawColumns
  ) as Column<any>[];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">{m['admin.affiliates.title']()}</h1>
        <p className="text-muted-foreground">
          {m['admin.affiliates.description']()}
        </p>
      </div>

      <TabStrip
        tabs={tabs}
        value={tab}
        onChange={setTab}
        label={(t) => tDynamic(`admin.affiliates.tab_${t}`)}
      />

      {tab === 'statistics' ? (
        <AffiliateStatistics />
      ) : tab === 'settings' ? (
        <AffiliateSettings canWrite={canWriteSettings} />
      ) : (
        <Card>
          <CardContent>
            <DataTable
              columns={columns}
              data={listQuery.data?.items ?? []}
              total={listQuery.data?.total ?? 0}
              page={page}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              rowKey={(r) => String(r.id)}
              emptyText={m['admin.affiliates.empty']()}
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder={tDynamic(`admin.affiliates.search_${tab}`)}
              toolbar={toolbar}
              onRefresh={() => listQuery.refetch()}
              loading={listQuery.isFetching || listQuery.isPending}
            />
          </CardContent>
        </Card>
      )}

      <AffiliateDetailDialog
        affiliate={detail}
        onClose={() => setDetail(null)}
      />

      {/* Review / own commission percent */}
      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open && !updateAffiliate.isPending) setEditing(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{m['admin.affiliates.edit.title']()}</DialogTitle>
            <DialogDescription>
              {editing?.userEmail || editing?.userName}
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              saveEdit();
            }}
          >
            {editing?.applyReason ? (
              <div className="space-y-1.5">
                <Label>{m['admin.affiliates.fields.apply_reason']()}</Label>
                <p className="bg-muted/50 rounded-md border px-3 py-2 text-sm whitespace-pre-wrap">
                  {editing.applyReason}
                </p>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{m['admin.affiliates.fields.status']()}</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(v) =>
                    setEditForm({ ...editForm, status: v || 'pending' })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AFFILIATE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {tDynamic(`admin.affiliates.status.${s}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="affiliate-commission">
                  {m['admin.affiliates.fields.commission_percent']()}
                </Label>
                <div className="relative">
                  <Input
                    id="affiliate-commission"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={50}
                    step={1}
                    className="pr-8"
                    placeholder={m['admin.affiliates.commission_global']()}
                    value={editForm.commissionPercent}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        commissionPercent: e.target.value,
                      })
                    }
                  />
                  <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm">
                    %
                  </span>
                </div>
              </div>
            </div>
            <p className="text-muted-foreground -mt-2 text-xs">
              {m['admin.affiliates.edit.commission_tip']()}
            </p>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={updateAffiliate.isPending}
                onClick={() => setEditing(null)}
              >
                {m['admin.affiliates.buttons.cancel']()}
              </Button>
              <Button type="submit" disabled={updateAffiliate.isPending}>
                {updateAffiliate.isPending
                  ? m['admin.affiliates.buttons.saving']()
                  : m['admin.affiliates.buttons.save']()}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Manual commission for an invitee's first paid order */}
      <Dialog
        open={!!rewarding}
        onOpenChange={(open) => {
          if (!open && !createReward.isPending) setRewarding(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m['admin.affiliates.reward.title']()}</DialogTitle>
            <DialogDescription>
              {m['admin.affiliates.reward.description']()}
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              saveReward();
            }}
          >
            {rewarding && (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="space-y-1">
                  <p className="text-muted-foreground">
                    {m['admin.affiliates.fields.inviter']()}
                  </p>
                  <p className="break-all">
                    {rewarding.inviterEmail || rewarding.inviterName || '—'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">
                    {m['admin.affiliates.fields.invitee']()}
                  </p>
                  <p className="break-all">
                    {rewarding.inviteeEmail || rewarding.inviteeName || '—'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">
                    {m['admin.affiliates.fields.order_no']()}
                  </p>
                  <p className="font-mono text-xs break-all">
                    {rewarding.orderNo || '—'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">
                    {m['admin.affiliates.fields.first_paid_amount']()}
                  </p>
                  <p className="font-medium">
                    {rewardPaid ? formatMoney(rewardPaid, rewardCurrency) : '—'}
                  </p>
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>{m['admin.affiliates.reward.type']()}</Label>
              <Select
                value={rewardForm.rewardType}
                onValueChange={(v) =>
                  setRewardForm({
                    ...rewardForm,
                    rewardType: v === 'percent' ? 'percent' : 'fixed',
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">
                    {m['admin.affiliates.reward.type_fixed']()}
                  </SelectItem>
                  <SelectItem value="percent">
                    {m['admin.affiliates.reward.type_percent']()}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {rewardForm.rewardType === 'percent' ? (
              <div className="space-y-1.5">
                <Label htmlFor="reward-percent">
                  {m['admin.affiliates.reward.percent']()}
                </Label>
                <Input
                  id="reward-percent"
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  value={rewardForm.percent}
                  onChange={(e) =>
                    setRewardForm({ ...rewardForm, percent: e.target.value })
                  }
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="reward-amount">
                  {m['admin.affiliates.reward.amount']({
                    currency: rewardCurrency,
                  })}
                </Label>
                <Input
                  id="reward-amount"
                  type="number"
                  min={0}
                  step="any"
                  value={rewardForm.amount}
                  onChange={(e) =>
                    setRewardForm({ ...rewardForm, amount: e.target.value })
                  }
                />
              </div>
            )}
            <p className="text-muted-foreground text-xs">
              {m['admin.affiliates.reward.preview']({
                amount:
                  rewardMinor > 0
                    ? formatMoney(rewardMinor, rewardCurrency)
                    : '—',
              })}
            </p>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={createReward.isPending}
                onClick={() => setRewarding(null)}
              >
                {m['admin.affiliates.buttons.cancel']()}
              </Button>
              <Button type="submit" disabled={createReward.isPending}>
                {createReward.isPending
                  ? m['admin.affiliates.buttons.saving']()
                  : m['admin.affiliates.buttons.create_reward']()}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Settle a payout request */}
      <Dialog
        open={!!processing}
        onOpenChange={(open) => {
          if (!open && !updateWithdraw.isPending) setProcessing(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{m['admin.affiliates.withdraw.title']()}</DialogTitle>
            <DialogDescription>
              {processing?.status === 'pending'
                ? m['admin.affiliates.withdraw.description_pending']()
                : m['admin.affiliates.withdraw.description_done']()}
            </DialogDescription>
          </DialogHeader>
          {processing && (
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="space-y-1">
                  <p className="text-muted-foreground">
                    {m['admin.affiliates.fields.withdraw_no']()}
                  </p>
                  <p className="font-mono text-xs break-all">
                    {processing.transactionNo}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">
                    {m['admin.affiliates.fields.amount']()}
                  </p>
                  <p className="font-medium">
                    {formatMoney(processing.amount, processing.currency)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">
                    {m['admin.affiliates.fields.affiliate']()}
                  </p>
                  <p className="break-all">
                    {processing.userEmail || processing.userName || '—'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">
                    {m['admin.affiliates.fields.status']()}
                  </p>
                  <WithdrawStatusBadge status={processing.status} />
                </div>
                <div className="col-span-2 space-y-1">
                  <p className="text-muted-foreground">
                    {m['admin.affiliates.fields.payout_details']()}
                  </p>
                  <p className="bg-muted/50 rounded-md border px-3 py-2 break-words whitespace-pre-wrap">
                    {processing.description || '—'}
                  </p>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="withdraw-remark">
                  {m['admin.affiliates.fields.remark']()}
                </Label>
                <Textarea
                  id="withdraw-remark"
                  rows={3}
                  maxLength={1000}
                  value={remark}
                  placeholder={m[
                    'admin.affiliates.withdraw.remark_placeholder'
                  ]()}
                  onChange={(e) => setRemark(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={updateWithdraw.isPending}
              onClick={() => setProcessing(null)}
            >
              {m['admin.affiliates.buttons.cancel']()}
            </Button>
            {processing?.status === 'pending' ? (
              <>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={updateWithdraw.isPending}
                  onClick={() => settle('rejected')}
                >
                  {m['admin.affiliates.withdraw.reject']()}
                </Button>
                <Button
                  type="button"
                  disabled={updateWithdraw.isPending}
                  onClick={() => settle('success')}
                >
                  {m['admin.affiliates.withdraw.mark_paid']()}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                disabled={updateWithdraw.isPending}
                onClick={() =>
                  processing &&
                  updateWithdraw.mutate({
                    id: processing.id,
                    remark: remark.trim(),
                  })
                }
              >
                {updateWithdraw.isPending
                  ? m['admin.affiliates.buttons.saving']()
                  : m['admin.affiliates.withdraw.save_remark']()}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </div>
  );
}

/** Default code first, the rest as "+N" (hover lists them all). */
function CodeSummary({
  codes,
}: {
  codes: { code: string; isDefault: boolean }[];
}) {
  if (!codes.length) return <span className="text-muted-foreground">—</span>;
  const primary = codes.find((c) => c.isDefault) ?? codes[0];
  return (
    <div
      className="flex items-center gap-1.5 whitespace-nowrap"
      title={codes.map((c) => c.code).join('\n')}
    >
      <span className="font-mono text-xs">{primary.code}</span>
      {codes.length > 1 && (
        <span className="text-muted-foreground text-xs">
          +{codes.length - 1}
        </span>
      )}
    </div>
  );
}

export const Route = createFileRoute('/admin/affiliates')({
  validateSearch: (search: Record<string, unknown>): { tab?: string } =>
    typeof search.tab === 'string' && search.tab ? { tab: search.tab } : {},
  component: AffiliatesAdminPage,
});
