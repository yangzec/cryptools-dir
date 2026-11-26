import { useEffect, useState } from 'react';
import { useForm } from '@tanstack/react-form';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Ban, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { tDynamic } from '@/core/i18n/dynamic';
import { apiDelete, apiGet, apiPut, type PageResult } from '@/lib/api-client';
import { faviconUrlForWebsite } from '@/lib/directory/favicon-url';
import { formatDateTime } from '@/lib/time';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { useConfirm } from '@/hooks/use-confirm';
import { DataTable, type Column } from '@/components/data-table';
import { DirectoryListIcon } from '@/components/directory/DirectoryListIcon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import {
  canDeleteAd,
  canForceExpireAd,
  PAGE_SIZE,
  renderAdFields,
  schema,
  TABS,
  valuesFromAd,
  type DirAd,
  type FormValues,
  type Tab,
} from './-ads-form';
import { DirectoryFormBody, DirectoryFormDrawer } from './-form-ui';

function AdEditForm({
  initial,
  saving,
  onCancel,
  onSave,
}: {
  initial: FormValues;
  saving: boolean;
  onCancel: () => void;
  onSave: (value: FormValues) => Promise<void>;
}) {
  const form = useForm({
    defaultValues: initial,
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      await onSave(value);
    },
  });
  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
    >
      <DirectoryFormBody
        actions={
          <>
            <Button type="button" variant="outline" onClick={onCancel}>
              {m['admin.directory.common.cancel']()}
            </Button>
            <Button type="submit" disabled={saving}>
              {m['admin.directory.common.save']()}
            </Button>
          </>
        }
      >
        {renderAdFields(form)}
      </DirectoryFormBody>
    </form>
  );
}

function DirectoryAdsPage() {
  const queryClient = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [editing, setEditing] = useState<DirAd | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [debouncedSearch, tab]);

  const listQuery = useQuery({
    queryKey: ['admin-dir-ads', page, tab, debouncedSearch],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (tab !== 'all') params.set('status', tab);
      if (debouncedSearch) params.set('search', debouncedSearch);
      return apiGet<PageResult<DirAd>>(`/api/admin/directory/ads?${params}`);
    },
    placeholderData: keepPreviousData,
  });

  function openEdit(row: DirAd) {
    setEditing(row);
  }

  const editMutation = useMutation({
    mutationFn: (value: Record<string, unknown>) =>
      apiPut('/api/admin/directory/ads', value),
    onSuccess: () => {
      toast.success(m['admin.directory.ads.updated']());
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['admin-dir-ads'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const expireMutation = useMutation({
    mutationFn: (id: string) =>
      apiPut('/api/admin/directory/ads', { id, forceExpire: true }),
    onSuccess: () => {
      toast.success(m['admin.directory.ads.force_expired']());
      queryClient.invalidateQueries({ queryKey: ['admin-dir-ads'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/admin/directory/ads?id=${id}`),
    onSuccess: () => {
      toast.success(m['admin.directory.ads.deleted']());
      queryClient.invalidateQueries({ queryKey: ['admin-dir-ads'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleForceExpire(row: DirAd) {
    const ok = await confirm({
      title: m['admin.directory.ads.force_expire_title'](),
      description: m['admin.directory.ads.force_expire_confirm'](),
      confirmLabel: m['admin.directory.ads.force_expire'](),
      destructive: true,
    });
    if (!ok) return;
    expireMutation.mutate(row.id);
  }

  async function handleDelete(row: DirAd) {
    const ok = await confirm({
      title: m['admin.directory.ads.delete_title'](),
      description: m['admin.directory.ads.delete_confirm'](),
      confirmLabel: m['admin.directory.common.delete'](),
      destructive: true,
    });
    if (!ok) return;
    deleteMutation.mutate(row.id);
  }

  const columns: Column<DirAd>[] = [
    {
      header: m['admin.directory.ads.col_name'](),
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-2">
          <DirectoryListIcon
            src={r.iconUrl || faviconUrlForWebsite(r.url)}
            alt={r.name}
            size={28}
          />
          <div className="min-w-0">
            <p className="truncate font-medium">{r.name}</p>
            <p className="text-muted-foreground truncate text-xs">{r.url}</p>
          </div>
        </div>
      ),
    },
    {
      header: m['admin.directory.ads.col_tier'](),
      cell: (r) => (
        <Badge variant="secondary">
          {tDynamic(`admin.directory.tier_${r.tier}`)}
        </Badge>
      ),
    },
    {
      header: m['admin.directory.common.status'](),
      cell: (r) => (
        <Badge
          variant={
            r.status === 'active'
              ? 'default'
              : r.status === 'expired'
                ? 'secondary'
                : 'outline'
          }
        >
          {tDynamic(`admin.directory.status_${r.status}`)}
        </Badge>
      ),
    },
    {
      header: m['admin.directory.ads.col_period'](),
      className: 'hidden md:table-cell',
      cell: (r) => (
        <span className="text-muted-foreground text-xs">
          {r.startsAt ? formatDateTime(r.startsAt) : '—'}
          {' → '}
          {r.endsAt ? formatDateTime(r.endsAt) : '—'}
        </span>
      ),
    },
    {
      header: m['admin.directory.common.actions'](),
      className: 'w-[110px]',
      cell: (r) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => openEdit(r)}
          >
            <Pencil className="size-3" />
          </Button>
          {canForceExpireAd(r.status) ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              title={m['admin.directory.ads.force_expire']()}
              onClick={() => handleForceExpire(r)}
            >
              <Ban className="size-3" />
            </Button>
          ) : null}
          {canDeleteAd(r.status) ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => handleDelete(r)}
            >
              <Trash2 className="size-3" />
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {confirmDialog}
      <div>
        <h1 className="text-2xl font-bold">
          {m['admin.directory.ads.title']()}
        </h1>
        <p className="text-muted-foreground">
          {m['admin.directory.ads.description']()}
        </p>
      </div>

      <div className="border-border flex gap-1 overflow-x-auto overflow-y-hidden border-b">
        {TABS.map((tb) => (
          <button
            key={tb}
            type="button"
            onClick={() => setTab(tb)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors',
              tab === tb
                ? 'border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground border-transparent'
            )}
          >
            {tDynamic(`admin.directory.ads.tab_${tb}`)}
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
            emptyText={m['admin.directory.ads.empty']()}
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder={m['admin.directory.common.search']()}
            onRefresh={() => listQuery.refetch()}
            loading={listQuery.isFetching || listQuery.isPending}
          />
        </CardContent>
      </Card>

      <DirectoryFormDrawer
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        title={m['admin.directory.ads.edit_title']()}
      >
        {editing ? (
          <AdEditForm
            key={editing.id}
            initial={valuesFromAd(editing)}
            saving={editMutation.isPending}
            onCancel={() => setEditing(null)}
            onSave={async (value) => {
              // Billing fields are locked in UI and ignored by the API.
              await editMutation.mutateAsync({
                id: editing.id,
                name: value.name.trim(),
                tagline: value.tagline.trim(),
                url: value.url.trim(),
                iconUrl: value.iconUrl.trim(),
              });
            }}
          />
        ) : null}
      </DirectoryFormDrawer>
    </div>
  );
}

export const Route = createFileRoute('/admin/directory/ads')({
  component: DirectoryAdsPage,
});
