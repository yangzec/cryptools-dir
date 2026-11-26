import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { tDynamic } from '@/core/i18n/dynamic';
import { apiGet, type PageResult } from '@/lib/api-client';
import { formatDateTime } from '@/lib/time';
import { m } from '@/paraglide/messages.js';
import { DataTable, type Column } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Order {
  id: string;
  orderNo: string;
  status: string;
  amount: number;
  currency: string;
  paymentType: string | null;
  paymentProvider: string;
  productName: string | null;
  createdAt: string;
  paidAt: string | null;
}

const PAGE_SIZE = 10;
const ORDER_STATUSES = [
  'pending',
  'created',
  'paid',
  'failed',
  'refunding',
  'refunded',
  'deleted',
] as const;
// Stored order.paymentType values → label keys (settings.payments.tab_*).
const ORDER_TYPES = [
  ['one-time', 'one_time'],
  ['subscription', 'subscription'],
  ['renew', 'renew'],
] as const;

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(amount / 100);
}

const orderStatusVariant = (s: string) => {
  if (s === 'paid') return 'default';
  if (s === 'failed') return 'destructive';
  return 'secondary';
};

export function UserOrders({ userId }: { userId: string }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [paymentType, setPaymentType] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [status, paymentType, debouncedSearch]);

  const query = useQuery({
    queryKey: [
      'admin-user-orders',
      userId,
      page,
      status,
      paymentType,
      debouncedSearch,
    ],
    queryFn: () => {
      const params = new URLSearchParams({
        userId,
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (status !== 'all') params.set('status', status);
      if (paymentType !== 'all') params.set('paymentType', paymentType);
      if (debouncedSearch) params.set('search', debouncedSearch);
      return apiGet<PageResult<Order>>(`/api/admin/orders?${params}`);
    },
    placeholderData: keepPreviousData,
  });

  const columns: Column<Order>[] = [
    {
      header: m['admin.payments.order_no'](),
      cell: (o) => <span className="font-mono text-xs">{o.orderNo}</span>,
    },
    {
      header: m['admin.payments.product_name_label'](),
      cell: (o) => o.productName || '—',
    },
    {
      header: m['admin.payments.amount'](),
      cell: (o) => (
        <span className="font-medium">
          {formatAmount(o.amount, o.currency)}
        </span>
      ),
    },
    {
      header: m['admin.payments.status'](),
      cell: (o) => (
        <Badge variant={orderStatusVariant(o.status)}>
          {tDynamic(`admin.payments.status_${o.status}`)}
        </Badge>
      ),
    },
    {
      header: m['admin.payments.type'](),
      cell: (o) => {
        const type = ORDER_TYPES.find(([value]) => value === o.paymentType);
        return type
          ? tDynamic(`settings.payments.tab_${type[1]}`)
          : o.paymentType || '—';
      },
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
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m['admin.user_detail.orders_title']()}</CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={query.data?.items ?? []}
          total={query.data?.total ?? 0}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          rowKey={(o) => o.id}
          emptyText={m['admin.payments.no_payments']()}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={m['admin.user_detail.order_search']()}
          toolbar={
            <div className="flex gap-2">
              <Select
                value={status}
                onValueChange={(value) => setStatus(value || 'all')}
              >
                <SelectTrigger className="h-8 w-[130px]">
                  <SelectValue>
                    {(value: string) =>
                      value === 'all'
                        ? m['admin.user_detail.status_all']()
                        : tDynamic(`admin.payments.status_${value}`)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {m['admin.user_detail.status_all']()}
                  </SelectItem>
                  {ORDER_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {tDynamic(`admin.payments.status_${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={paymentType}
                onValueChange={(value) => setPaymentType(value || 'all')}
              >
                <SelectTrigger className="h-8 w-[130px]">
                  <SelectValue>
                    {(value: string) => {
                      const type = ORDER_TYPES.find(([v]) => v === value);
                      return type
                        ? tDynamic(`settings.payments.tab_${type[1]}`)
                        : m['admin.user_detail.type_all']();
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {m['admin.user_detail.type_all']()}
                  </SelectItem>
                  {ORDER_TYPES.map(([value, key]) => (
                    <SelectItem key={value} value={value}>
                      {tDynamic(`settings.payments.tab_${key}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          }
          onRefresh={() => query.refetch()}
          loading={query.isFetching || query.isPending}
        />
      </CardContent>
    </Card>
  );
}
