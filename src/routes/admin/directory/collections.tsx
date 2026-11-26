import { useEffect, useState } from 'react';
import { useForm } from '@tanstack/react-form';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { ListTree, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { tDynamic } from '@/core/i18n/dynamic';
import {
  apiDelete,
  apiGet,
  apiPost,
  apiPut,
  pageQuery,
  type PageResult,
} from '@/lib/api-client';
import { formatDateTime } from '@/lib/time';
import { m } from '@/paraglide/messages.js';
import { useConfirm } from '@/hooks/use-confirm';
import { DataTable, type Column } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import {
  emptyForm,
  PAGE_SIZE,
  renderCollectionFields,
  schema,
  toEditPayload,
  toPayload,
  valuesFromCollection,
  type DirCollection,
  type FormValues,
  type ToolOption,
} from './-collections-form';
import { CollectionToolsDialog } from './-collections-tools-dialog';
import { DirectoryFormBody, DirectoryFormDrawer } from './-form-ui';

function CollectionEditForm({
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
        {renderCollectionFields(form, { lockSlug: true })}
      </DirectoryFormBody>
    </form>
  );
}

function DirectoryCollectionsPage() {
  const queryClient = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<DirCollection | null>(null);
  const [managingTools, setManagingTools] = useState<DirCollection | null>(
    null
  );

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [debouncedSearch]);

  const listQuery = useQuery({
    queryKey: ['admin-dir-collections', page, debouncedSearch],
    queryFn: () =>
      apiGet<PageResult<DirCollection>>(
        pageQuery('/api/admin/directory/collections', {
          page,
          pageSize: PAGE_SIZE,
          search: debouncedSearch,
        })
      ),
    placeholderData: keepPreviousData,
  });

  const toolsQuery = useQuery({
    queryKey: ['admin-dir-tool-options'],
    queryFn: () => apiGet<ToolOption[]>('/api/admin/directory/tools?all=true'),
    enabled: !!managingTools,
  });
  const tools = toolsQuery.data || [];

  const createForm = useForm({
    defaultValues: { ...emptyForm },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      await createMutation.mutateAsync(toPayload(value));
    },
  });
  function openEdit(row: DirCollection) {
    setEditing(row);
  }

  const createMutation = useMutation({
    mutationFn: (value: ReturnType<typeof toPayload>) =>
      apiPost('/api/admin/directory/collections', value),
    onSuccess: () => {
      toast.success(m['admin.directory.collections.created']());
      setCreateOpen(false);
      createForm.reset();
      queryClient.invalidateQueries({ queryKey: ['admin-dir-collections'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const editMutation = useMutation({
    mutationFn: (value: ReturnType<typeof toEditPayload> & { id: string }) =>
      apiPut('/api/admin/directory/collections', value),
    onSuccess: () => {
      toast.success(m['admin.directory.collections.updated']());
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['admin-dir-collections'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiDelete(`/api/admin/directory/collections?id=${id}`),
    onSuccess: () => {
      toast.success(m['admin.directory.collections.deleted']());
      queryClient.invalidateQueries({ queryKey: ['admin-dir-collections'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleDelete(row: DirCollection) {
    const ok = await confirm({
      title: m['admin.directory.collections.delete_title'](),
      description: m['admin.directory.collections.delete_confirm']({
        count: row.toolCount || 0,
      }),
      confirmLabel: m['admin.directory.common.delete'](),
      destructive: true,
    });
    if (!ok) return;
    deleteMutation.mutate(row.id);
  }

  const columns: Column<DirCollection>[] = [
    {
      header: m['admin.directory.common.slug'](),
      cell: (r) => <span className="font-mono text-sm">{r.slug}</span>,
    },
    {
      header: m['admin.directory.common.name'](),
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{r.name}</p>
          {r.nameZh ? (
            <p className="text-muted-foreground truncate text-xs">{r.nameZh}</p>
          ) : null}
        </div>
      ),
    },
    {
      header: m['admin.directory.collections.tools'](),
      cell: (r) => (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 tabular-nums"
          onClick={() => setManagingTools(r)}
        >
          {r.toolCount}
        </Button>
      ),
    },
    {
      header: m['admin.directory.collections.sort'](),
      cell: (r) => <span className="text-sm">{r.sort}</span>,
    },
    {
      header: m['admin.directory.common.status'](),
      cell: (r) => (
        <Badge variant={r.status === 'published' ? 'default' : 'secondary'}>
          {tDynamic(`admin.directory.status_${r.status}`)}
        </Badge>
      ),
    },
    {
      header: m['admin.directory.common.created_at'](),
      cell: (r) => (
        <span className="text-muted-foreground text-sm">
          {formatDateTime(r.createdAt)}
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
            title={m['admin.directory.collections.manage_tools']()}
            onClick={() => setManagingTools(r)}
          >
            <ListTree className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => openEdit(r)}
          >
            <Pencil className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => handleDelete(r)}
          >
            <Trash2 className="size-3" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {confirmDialog}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {m['admin.directory.collections.title']()}
          </h1>
          <p className="text-muted-foreground">
            {m['admin.directory.collections.description']()}
          </p>
        </div>
        <Button
          className="gap-2"
          onClick={() => {
            createForm.reset({ ...emptyForm });
            setCreateOpen(true);
          }}
        >
          <Plus className="size-4" />
          {m['admin.directory.collections.create']()}
        </Button>
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
            emptyText={m['admin.directory.collections.empty']()}
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder={m['admin.directory.common.search']()}
            onRefresh={() => listQuery.refetch()}
            loading={listQuery.isFetching || listQuery.isPending}
          />
        </CardContent>
      </Card>

      <DirectoryFormDrawer
        open={createOpen}
        onOpenChange={(v) => {
          setCreateOpen(v);
          if (v) createForm.reset({ ...emptyForm });
        }}
        title={m['admin.directory.collections.create_title']()}
      >
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            createForm.handleSubmit();
          }}
        >
          <DirectoryFormBody
            actions={
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                >
                  {m['admin.directory.common.cancel']()}
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {m['admin.directory.common.save']()}
                </Button>
              </>
            }
          >
            {renderCollectionFields(createForm)}
          </DirectoryFormBody>
        </form>
      </DirectoryFormDrawer>

      <DirectoryFormDrawer
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        title={m['admin.directory.collections.edit_title']()}
      >
        {editing ? (
          <CollectionEditForm
            key={editing.id}
            initial={valuesFromCollection(editing)}
            saving={editMutation.isPending}
            onCancel={() => setEditing(null)}
            onSave={async (value) => {
              await editMutation.mutateAsync({
                id: editing.id,
                ...toEditPayload(value),
              });
            }}
          />
        ) : null}
      </DirectoryFormDrawer>

      <CollectionToolsDialog
        collection={managingTools}
        tools={tools}
        toolsLoading={toolsQuery.isPending || toolsQuery.isFetching}
        onClose={() => setManagingTools(null)}
        onSaved={() => {
          queryClient.invalidateQueries({
            queryKey: ['admin-dir-collections'],
          });
        }}
      />
    </div>
  );
}

export const Route = createFileRoute('/admin/directory/collections')({
  component: DirectoryCollectionsPage,
});
