import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Coins, Eye, KeyRound, MoreHorizontal, Shield } from 'lucide-react';

import { apiGet, pageQuery, type PageResult } from '@/lib/api-client';
import { formatDateTime } from '@/lib/time';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { DataTable, type Column } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserCell } from '@/components/user-cell';

import { CopyButton } from './-copy-button';
import {
  ManageCreditsDialog,
  ManageRolesDialog,
  SetPasswordDialog,
  type User,
} from './-users-dialogs';

interface SourceOption {
  value: string;
  count: number;
}

// Select values can't be '' — sentinels for "no filter" and "untagged".
const ANY = '__any__';
const NONE = '__none__';

const PAGE_SIZE = 20;

function UsersPage() {
  // `?search=` / `?utm_source=` prefill the filters (deep links from other admin pages).
  const { search: initialSearch = '', utm_source: initialSource } =
    Route.useSearch();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  // undefined = any source; '' = untagged (direct) sign-ups.
  const [source, setSource] = useState<string | undefined>(initialSource);

  // Role management dialog
  const [managingUser, setManagingUser] = useState<User | null>(null);

  // Credits dialog
  const [passwordUser, setPasswordUser] = useState<User | null>(null);
  const [creditsUser, setCreditsUser] = useState<User | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, source]);

  const listQuery = useQuery({
    queryKey: ['admin-users', page, debouncedSearch, source],
    queryFn: () => {
      const base = pageQuery('/api/admin/users', {
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch,
      });
      return apiGet<PageResult<User>>(
        source === undefined
          ? base
          : `${base}&utm_source=${encodeURIComponent(source)}`
      );
    },
    placeholderData: keepPreviousData,
  });

  const sourcesQuery = useQuery({
    queryKey: ['admin-users-sources'],
    queryFn: () => apiGet<SourceOption[]>('/api/admin/users/sources'),
    staleTime: 5 * 60_000,
  });

  const sourceTitle = m['admin.users.source_col']();
  const untagged = m['admin.users.source_none']();
  const sourceOptions = sourcesQuery.data ?? [];
  const sourceItems = [
    { value: ANY, label: `${sourceTitle}: ${m['admin.analytics.any']()}` },
    // Keep the active value selectable even if it isn't a top value.
    ...(source !== undefined && !sourceOptions.some((o) => o.value === source)
      ? [
          {
            value: source || NONE,
            label: `${sourceTitle}: ${source || untagged}`,
          },
        ]
      : []),
    ...sourceOptions.map((o) => ({
      value: o.value || NONE,
      label: `${sourceTitle}: ${o.value || untagged} (${o.count})`,
    })),
  ];

  const columns: Column<User>[] = [
    {
      header: m['admin.users.id_col'](),
      cell: (u) => (
        <div className="flex items-center gap-1">
          <span className="font-mono text-xs" title={u.id}>
            {u.id.slice(0, 8)}…
          </span>
          <CopyButton value={u.id} />
        </div>
      ),
    },
    {
      header: m['admin.users.user_col'](),
      // List → detail stays in the same tab here.
      cell: (u) => (
        <UserCell
          userId={u.id}
          name={u.name}
          email={u.email}
          image={u.image}
          newTab={false}
        />
      ),
    },
    {
      header: m['admin.users.roles_col'](),
      cell: (u) =>
        u.roles.length ? (
          <div className="flex flex-wrap gap-1">
            {u.roles.map((r) => (
              <Badge key={r.name} variant="secondary" title={r.name}>
                {r.title}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      header: m['admin.users.source_col'](),
      cell: (u) =>
        u.utmSource ? (
          <span className="bg-muted inline-flex rounded-md px-2 py-0.5 text-xs font-medium">
            {u.utmSource}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      header: m['admin.users.ip_col'](),
      cell: (u) =>
        u.ip ? (
          <span className="text-muted-foreground font-mono text-xs">
            {u.ip}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      header: m['admin.users.credits_col'](),
      className: 'w-[120px]',
      cell: (u) => (
        <span className="font-medium tabular-nums">
          {u.credits.toLocaleString()}
        </span>
      ),
    },
    {
      header: m['admin.users.joined_col'](),
      cell: (u) => (
        <span className="text-muted-foreground">
          {formatDateTime(u.createdAt)}
        </span>
      ),
    },
    {
      header: m['admin.users.actions_col'](),
      className: 'w-[80px]',
      cell: (u) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" className="size-7">
                <MoreHorizontal className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent
            align="end"
            className="w-auto min-w-40 whitespace-nowrap"
          >
            <DropdownMenuItem
              render={<Link to="/admin/users/$id" params={{ id: u.id }} />}
            >
              <Eye className="size-4" />
              {m['admin.user_detail.view']()}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCreditsUser(u)}>
              <Coins className="size-4" />
              {m['admin.users.manage_credits_title']()}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setManagingUser(u)}>
              <Shield className="size-4" />
              {m['admin.users.manage_roles_title']()}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setPasswordUser(u);
              }}
            >
              <KeyRound className="size-4" />
              {m['admin.users.set_password_title']()}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">{m['admin.users.title']()}</h1>
        <p className="text-muted-foreground">
          {m['admin.users.description']()}
        </p>
      </div>

      <Card>
        <CardContent>
          <DataTable
            columns={columns}
            data={listQuery.data?.items ?? []}
            total={listQuery.data?.total ?? 0}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            rowKey={(u) => u.id}
            emptyText={m['admin.users.no_users']()}
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder={m['admin.users.search_placeholder']()}
            toolbar={
              <Select
                items={sourceItems}
                value={source === undefined ? ANY : source || NONE}
                onValueChange={(v) =>
                  setSource(
                    !v || v === ANY ? undefined : v === NONE ? '' : String(v)
                  )
                }
              >
                <SelectTrigger
                  className={cn(
                    'h-9 max-w-60',
                    source !== undefined && 'border-primary'
                  )}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sourceItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
            onRefresh={() => listQuery.refetch()}
            loading={listQuery.isFetching || listQuery.isPending}
          />
        </CardContent>
      </Card>

      <ManageRolesDialog
        user={managingUser}
        onClose={() => setManagingUser(null)}
      />
      <SetPasswordDialog
        user={passwordUser}
        onClose={() => setPasswordUser(null)}
      />
      <ManageCreditsDialog
        user={creditsUser}
        onClose={() => setCreditsUser(null)}
      />
    </div>
  );
}

export const Route = createFileRoute('/admin/users')({
  validateSearch: (
    search: Record<string, unknown>
  ): { search?: string; utm_source?: string } => {
    const result: { search?: string; utm_source?: string } = {};
    if (typeof search.search === 'string' && search.search) {
      result.search = search.search;
    }
    // '' is meaningful here (untagged users), so keep empty strings.
    if (typeof search.utm_source === 'string') {
      result.utm_source = search.utm_source;
    }
    return result;
  },
  component: UsersPage,
});
