import { useEffect, useState } from 'react';
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Eye } from 'lucide-react';

import { tDynamic } from '@/core/i18n/dynamic';
import { apiGet, pageQuery, type PageResult } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import {
  formatDate,
  useGuestPostInfo,
  type GuestPostRow,
} from '@/hooks/use-guest-posts';
import { DataTable, type Column } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { UserCell } from '@/components/user-cell';

import {
  ArticleUrl,
  GuestPostStatusBadge,
  PackageCell,
  ReviewNoteCell,
} from '../settings/guest-posts/-shared';
import { ReviewPanel } from './-guest-posts-review';

const PAGE_SIZE = 20;
// "All" leads, like the other admin tabs.
const TABS = [
  'all',
  'submitted',
  'published',
  'changes_requested',
  'rejected',
  'unpublished',
] as const;
type Tab = (typeof TABS)[number];

function AdminGuestPostsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const info = useGuestPostInfo();

  // `?id=` opens that submission (deep links from bot notifications).
  const deepLinkId = Route.useSearch().id;
  useEffect(() => {
    if (deepLinkId) setOpenId(deepLinkId);
  }, [deepLinkId]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [debounced, tab]);

  const listQuery = useQuery({
    queryKey: ['admin-guest-posts', page, tab, debounced],
    queryFn: () =>
      apiGet<PageResult<GuestPostRow>>(
        pageQuery('/api/admin/guest-posts', {
          page,
          pageSize: PAGE_SIZE,
          search: debounced,
        }) + (tab === 'all' ? '' : `&status=${tab}`)
      ),
    placeholderData: keepPreviousData,
  });

  const columns: Column<GuestPostRow>[] = [
    {
      header: m['admin.guest_posts.title_col'](),
      cell: (r) => (
        <div className="min-w-0">
          <button
            className="text-left font-medium hover:underline"
            onClick={() => setOpenId(r.id)}
          >
            {r.title || '—'}
          </button>
          <ArticleUrl slug={r.slug} status={r.status} />
        </div>
      ),
    },
    {
      header: m['admin.guest_posts.author_col'](),
      cell: (r) =>
        r.userId ? (
          <UserCell
            userId={r.userId}
            name={r.userName}
            email={r.userEmail}
            image={r.userAvatar}
          />
        ) : (
          '—'
        ),
    },
    {
      header: m['guest_posts.package_col'](),
      className: 'w-[170px]',
      cell: (r) => (
        <PackageCell productId={r.productId} packages={info.data?.packages} />
      ),
    },
    {
      header: m['admin.guest_posts.status_col'](),
      className: 'w-[130px]',
      cell: (r) => <GuestPostStatusBadge status={r.status} />,
    },
    {
      header: m['guest_posts.review_note'](),
      className: 'min-w-[220px]',
      cell: (r) => <ReviewNoteCell status={r.status} note={r.reviewNote} />,
    },
    {
      header: m['admin.guest_posts.updated_col'](),
      className: 'w-[170px]',
      cell: (r) => (
        <span className="text-muted-foreground">{formatDate(r.updatedAt)}</span>
      ),
    },
    {
      header: m['admin.guest_posts.actions_col'](),
      className: 'w-[80px]',
      cell: (r) => (
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          title={m['admin.guest_posts.view']()}
          onClick={() => setOpenId(r.id)}
        >
          <Eye className="size-3" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">{m['admin.guest_posts.title']()}</h1>
        <p className="text-muted-foreground">
          {m['admin.guest_posts.description']()}
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
            {tb === 'all'
              ? m['admin.guest_posts.tab_all']()
              : tDynamic(`guest_posts.status_${tb}`)}
          </button>
        ))}
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
            rowKey={(r) => r.id}
            emptyText={m['admin.guest_posts.empty']()}
            search={search}
            onSearchChange={setSearch}
            onRefresh={() => listQuery.refetch()}
            loading={listQuery.isFetching || listQuery.isPending}
          />
        </CardContent>
      </Card>

      <Dialog open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          {openId && (
            <ReviewPanel
              id={openId}
              onChanged={() => {
                queryClient.invalidateQueries({
                  queryKey: ['admin-guest-posts'],
                });
                queryClient.invalidateQueries({
                  queryKey: ['admin-guest-post', openId],
                });
              }}
              onDone={() => setOpenId(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Route = createFileRoute('/admin/guest-posts')({
  validateSearch: (search: Record<string, unknown>): { id?: string } =>
    typeof search.id === 'string' && search.id ? { id: search.id } : {},
  component: AdminGuestPostsPage,
});
