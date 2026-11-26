import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Pencil, Undo2 } from 'lucide-react';

import { tDynamic } from '@/core/i18n/dynamic';
import { apiGet, type PageResult } from '@/lib/api-client';
import { formatDateTime } from '@/lib/time';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { DataTable, type Column } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  EditOrderDialog,
  RefundOrderDialog,
  type Order,
} from './-payments-dialogs';

const FILTER_STATUSES = [
  'pending',
  'created',
  'paid',
  'failed',
  'refunded',
  'deleted',
  'refunding',
] as const;

const PAGE_SIZE = 20;

const TABS = ['all', 'subscription', 'one_time'] as const;
type Tab = (typeof TABS)[number];

function PaymentsPage() {
  // `?search=` prefills the filter (deep links from payment notifications).
  const initialSearch = Route.useSearch().search ?? '';
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [refundingOrder, setRefundingOrder] = useState<Order | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [tab, statusFilter, debouncedSearch]);

  const query = useQuery({
    queryKey: ['admin-payments', page, tab, statusFilter, debouncedSearch],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (tab === 'subscription') params.set('paymentType', 'subscription');
      if (tab === 'one_time') params.set('paymentType', 'one_time');
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (debouncedSearch) params.set('search', debouncedSearch);
      return apiGet<PageResult<Order>>(`/api/admin/orders?${params}`);
    },
    placeholderData: keepPreviousData,
  });

  const orders = query.data?.items ?? [];
  const total = query.data?.total ?? 0;

  function formatAmount(amount: number, currency: string) {
    const value = amount / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(value);
  }

  const statusVariant = (s: string) => {
    if (s === 'paid') return 'default';
    if (s === 'failed') return 'destructive';
    if (s === 'refunded' || s === 'refunding') return 'outline';
    return 'secondary';
  };

  const columns: Column<Order>[] = [
    {
      header: m['admin.payments.order_no'](),
      cell: (o) => <span className="font-mono text-xs">{o.orderNo}</span>,
    },
    {
      header: m['admin.payments.user'](),
      cell: (o) => (
        <UserCell
          userId={o.userId}
          name={o.userName}
          email={o.userAccountEmail || o.userEmail}
          image={o.userImage}
        />
      ),
    },
    {
      header: m['admin.payments.amount'](),
      cell: (o) => (
        <div className="flex flex-col">
          <span className="font-medium">
            {formatAmount(o.amount, o.currency)}
          </span>
          {o.refundAmount != null && (
            <span className="text-muted-foreground text-xs">
              {m['admin.payments.refunded_amount']({
                amount: formatAmount(o.refundAmount, o.currency),
              })}
            </span>
          )}
        </div>
      ),
    },
    {
      header: m['admin.payments.status'](),
      cell: (o) => (
        <Badge variant={statusVariant(o.status)}>
          {tDynamic(`admin.payments.status_${o.status}`)}
        </Badge>
      ),
    },
    {
      header: m['admin.payments.type'](),
      cell: (o) => o.paymentType || '—',
    },
    {
      header: m['admin.payments.provider'](),
      cell: (o) => o.paymentProvider,
    },
    {
      header: m['admin.payments.created_at'](),
      cell: (o) => (
        <span className="text-muted-foreground text-sm">
          {formatDateTime(o.createdAt)}
        </span>
      ),
    },
    {
      header: '',
      className: 'w-[88px]',
      cell: (o) => (
        <div className="flex items-center gap-1">
          {(o.status === 'paid' || o.status === 'refunding') && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              title={m['admin.payments.refund']()}
              aria-label={m['admin.payments.refund']()}
              onClick={() => setRefundingOrder(o)}
            >
              <Undo2 className="size-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => setEditingOrder(o)}
          >
            <Pencil className="size-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">{m['admin.payments.title']()}</h1>
        <p className="text-muted-foreground">
          {m['admin.payments.description']()}
        </p>
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
            {tDynamic(`admin.payments.tab_${tb}`)}
          </button>
        ))}
      </div>

      <Card>
        <CardContent>
          <DataTable
            columns={columns}
            data={orders}
            total={total}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            rowKey={(o) => o.id}
            emptyText={m['admin.payments.no_payments']()}
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder={m['admin.payments.search_placeholder']()}
            toolbar={
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value || 'all')}
              >
                <SelectTrigger className="h-8 w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {m['admin.payments.tab_all']()}
                  </SelectItem>
                  {FILTER_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {tDynamic(`admin.payments.status_${status}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
            onRefresh={() => query.refetch()}
            loading={query.isFetching || query.isPending}
          />
        </CardContent>
      </Card>

      <EditOrderDialog
        order={editingOrder}
        onClose={() => setEditingOrder(null)}
      />
      <RefundOrderDialog
        order={refundingOrder}
        onClose={() => setRefundingOrder(null)}
      />
    </div>
  );
}

export const Route = createFileRoute('/admin/payments')({
  validateSearch: (search: Record<string, unknown>): { search?: string } =>
    typeof search.search === 'string' && search.search
      ? { search: search.search }
      : {},
  component: PaymentsPage,
});
