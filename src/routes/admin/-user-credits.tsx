import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { tDynamic } from '@/core/i18n/dynamic';
import { apiGet, type PageResult } from '@/lib/api-client';
import { formatDateTime } from '@/lib/time';
import { cn } from '@/lib/utils';
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

interface Credit {
  id: string;
  transactionNo: string;
  transactionType: string;
  transactionScene: string | null;
  credits: number;
  remainingCredits: number;
  description: string | null;
  expiresAt: string | null;
  status: string;
  createdAt: string;
}

const PAGE_SIZE = 10;
const CREDIT_TYPES = ['grant', 'consume'] as const;
const CREDIT_STATUSES = ['active', 'expired', 'deleted'] as const;

function Empty() {
  return <span className="text-muted-foreground">—</span>;
}

export function UserCredits({ userId }: { userId: string }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [transactionType, setTransactionType] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [status, transactionType, debouncedSearch]);

  const query = useQuery({
    queryKey: [
      'admin-user-credits',
      userId,
      page,
      status,
      transactionType,
      debouncedSearch,
    ],
    queryFn: () => {
      const params = new URLSearchParams({
        userId,
        page: String(page),
        pageSize: String(PAGE_SIZE),
        // The endpoint defaults to active records; 'all' lifts that filter.
        status,
      });
      if (transactionType !== 'all')
        params.set('transactionType', transactionType);
      if (debouncedSearch) params.set('search', debouncedSearch);
      return apiGet<PageResult<Credit>>(`/api/admin/credits?${params}`);
    },
    placeholderData: keepPreviousData,
  });

  const columns: Column<Credit>[] = [
    {
      header: m['admin.credits.transaction_no'](),
      cell: (c) => <span className="font-mono text-xs">{c.transactionNo}</span>,
    },
    {
      header: m['admin.credits.amount'](),
      cell: (c) => (
        <span
          className={cn(
            'font-medium tabular-nums',
            c.credits > 0 ? 'text-green-600' : 'text-red-500'
          )}
        >
          {c.credits > 0 ? `+${c.credits}` : c.credits}
        </span>
      ),
    },
    {
      header: m['admin.credits.remaining'](),
      cell: (c) =>
        c.transactionType === 'grant' ? c.remainingCredits : <Empty />,
    },
    {
      header: m['admin.payments.status'](),
      cell: (c) => (
        <Badge variant={c.status === 'active' ? 'default' : 'secondary'}>
          {tDynamic(`admin.user_detail.credit_status_${c.status}`)}
        </Badge>
      ),
    },
    {
      header: m['admin.credits.type'](),
      cell: (c) => tDynamic(`admin.user_detail.tab_${c.transactionType}`),
    },
    {
      header: m['admin.credits.scene'](),
      cell: (c) => c.transactionScene || '—',
    },
    {
      header: m['admin.credits.description'](),
      cell: (c) => (
        <span className="text-muted-foreground block max-w-[240px] truncate text-sm">
          {c.description || '—'}
        </span>
      ),
    },
    {
      header: m['admin.credits.expires_at'](),
      cell: (c) => (
        <span className="text-muted-foreground text-sm">
          {c.expiresAt ? formatDateTime(c.expiresAt) : '—'}
        </span>
      ),
    },
    {
      header: m['admin.credits.created_at'](),
      cell: (c) => (
        <span className="text-muted-foreground text-sm">
          {formatDateTime(c.createdAt)}
        </span>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m['admin.user_detail.credits_title']()}</CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={query.data?.items ?? []}
          total={query.data?.total ?? 0}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          rowKey={(c) => c.id}
          emptyText={m['admin.credits.no_credits']()}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={m['admin.user_detail.credit_search']()}
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
                        : tDynamic(`admin.user_detail.credit_status_${value}`)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {m['admin.user_detail.status_all']()}
                  </SelectItem>
                  {CREDIT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {tDynamic(`admin.user_detail.credit_status_${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={transactionType}
                onValueChange={(value) => setTransactionType(value || 'all')}
              >
                <SelectTrigger className="h-8 w-[130px]">
                  <SelectValue>
                    {(value: string) =>
                      value === 'all'
                        ? m['admin.user_detail.type_all']()
                        : tDynamic(`admin.user_detail.tab_${value}`)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {m['admin.user_detail.type_all']()}
                  </SelectItem>
                  {CREDIT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {tDynamic(`admin.user_detail.tab_${t}`)}
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
