import { useEffect, useState } from 'react';
import { useForm } from '@tanstack/react-form';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Pencil, Plus, Trash2 } from 'lucide-react';
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
  renderCategoryFields,
  schema,
  toEditPayload,
  toPayload,
  valuesFromCategory,
  type DirCategory,
  type FormValues,
} from './-categories-form';
import { DirectoryFormBody, DirectoryFormDrawer } from './-form-ui';

function CategoryEditForm({
  initial,
  disableDraft,
  saving,
  onCancel,
  onSave,
}: {
  initial: FormValues;
  disableDraft: boolean;
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
        {renderCategoryFields(form, {
          lockSlug: true,
          disableDraft,
        })}
      </DirectoryFormBody>
    </form>
  );
}

function DirectoryCategoriesPage() {
  const queryClient = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<DirCategory | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [debouncedSearch]);

  const listQuery = useQuery({
    queryKey: ['admin-dir-categories', page, debouncedSearch],
    queryFn: () =>
      apiGet<PageResult<DirCategory>>(
        pageQuery('/api/admin/directory/categories', {
          page,
          pageSize: PAGE_SIZE,
          search: debouncedSearch,
        })
      ),
    placeholderData: keepPreviousData,
  });

  const createForm = useForm({
    defaultValues: { ...emptyForm },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      await createMutation.mutateAsync(toPayload(value));
    },
  });
  function openEdit(row: DirCategory) {
    setEditing(row);
  }

  const createMutation = useMutation({
    mutationFn: (value: ReturnType<typeof toPayload>) =>
      apiPost('/api/admin/directory/categories', value),
    onSuccess: () => {
      toast.success(m['admin.directory.categories.created']());
      setCreateOpen(false);
      createForm.reset();
      queryClient.invalidateQueries({ queryKey: ['admin-dir-categories'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const editMutation = useMutation({
    mutationFn: (value: ReturnType<typeof toEditPayload> & { id: string }) =>
      apiPut('/api/admin/directory/categories', value),
    onSuccess: () => {
      toast.success(m['admin.directory.categories.updated']());
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['admin-dir-categories'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiDelete(`/api/admin/directory/categories?id=${id}`),
    onSuccess: () => {
      toast.success(m['admin.directory.categories.deleted']());
      queryClient.invalidateQueries({ queryKey: ['admin-dir-categories'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleDelete(row: DirCategory) {
    if ((row.toolCount || 0) > 0) {
      toast.error(
        m['admin.directory.categories.delete_blocked']({
          count: row.toolCount,
        })
      );
      return;
    }
    const ok = await confirm({
      title: m['admin.directory.categories.delete_title'](),
      description: m['admin.directory.categories.delete_confirm'](),
      confirmLabel: m['admin.directory.common.delete'](),
      destructive: true,
    });
    if (!ok) return;
    deleteMutation.mutate(row.id);
  }

  const columns: Column<DirCategory>[] = [
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
      header: m['admin.directory.categories.tools'](),
      cell: (r) => (
        <span className="text-sm tabular-nums">{r.toolCount ?? 0}</span>
      ),
    },
    {
      header: m['admin.directory.categories.sort'](),
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
      className: 'w-[80px]',
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
          {(r.toolCount || 0) === 0 ? (
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {m['admin.directory.categories.title']()}
          </h1>
          <p className="text-muted-foreground">
            {m['admin.directory.categories.description']()}
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
          {m['admin.directory.categories.create']()}
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
            emptyText={m['admin.directory.categories.empty']()}
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
        title={m['admin.directory.categories.create_title']()}
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
            {renderCategoryFields(createForm)}
          </DirectoryFormBody>
        </form>
      </DirectoryFormDrawer>

      <DirectoryFormDrawer
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        title={m['admin.directory.categories.edit_title']()}
      >
        {editing ? (
          <CategoryEditForm
            key={editing.id}
            initial={valuesFromCategory(editing)}
            disableDraft={(editing.toolCount || 0) > 0}
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
    </div>
  );
}

export const Route = createFileRoute('/admin/directory/categories')({
  component: DirectoryCategoriesPage,
});
