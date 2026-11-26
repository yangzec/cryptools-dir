import { useEffect, useState } from 'react';
import { useForm } from '@tanstack/react-form';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

import { tDynamic } from '@/core/i18n/dynamic';
import {
  apiDelete,
  apiGet,
  apiPost,
  apiPut,
  type PageResult,
} from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { useConfirm } from '@/hooks/use-confirm';
import { DataTable } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import { DirectoryFormBody, DirectoryFormDrawer } from './-form-ui';
import { buildToolColumns } from './-tools-columns';
import { renderToolFields } from './-tools-form';
import {
  emptyForm,
  PAGE_SIZE,
  schema,
  TABS,
  toEditPayload,
  toPayload,
  valuesFromToolDetail,
  type DirTool,
  type FormValues,
  type Option,
  type Tab,
} from './-tools-shared';

/**
 * Fresh useForm per open (key=id). defaultValues carry the detail row so fields
 * + ImageUploader hydrate on first mount — Base UI Sheet unmounts closed content,
 * so parent-level reset() before fields exist left every input empty.
 */
function ToolEditForm({
  initial,
  cats,
  tags,
  saving,
  onCancel,
  onSave,
}: {
  initial: FormValues;
  cats: Option[];
  tags: Option[];
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
        {renderToolFields(form, cats, tags, { lockMeta: true })}
      </DirectoryFormBody>
    </form>
  );
}

function DirectoryToolsPage() {
  const queryClient = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [debouncedSearch, tab]);

  const listQuery = useQuery({
    queryKey: ['admin-dir-tools', page, tab, debouncedSearch],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (tab !== 'all') params.set('status', tab);
      if (debouncedSearch) params.set('search', debouncedSearch);
      return apiGet<PageResult<DirTool>>(
        `/api/admin/directory/tools?${params}`
      );
    },
    placeholderData: keepPreviousData,
  });

  const categoryOptions = useQuery({
    queryKey: ['admin-dir-category-options'],
    queryFn: () => apiGet<Option[]>('/api/admin/directory/categories?all=true'),
  });
  const tagOptions = useQuery({
    queryKey: ['admin-dir-tag-options'],
    queryFn: () => apiGet<Option[]>('/api/admin/directory/tags?all=true'),
  });

  const createForm = useForm({
    defaultValues: emptyForm,
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      await createMutation.mutateAsync(toPayload(value));
    },
  });
  const detailQuery = useQuery({
    queryKey: ['admin-dir-tool', editingId],
    queryFn: () =>
      apiGet<FormValues & { id: string }>(
        `/api/admin/directory/tools?id=${editingId}`
      ),
    enabled: !!editingId,
  });

  const createMutation = useMutation({
    mutationFn: (value: ReturnType<typeof toPayload>) =>
      apiPost('/api/admin/directory/tools', value),
    onSuccess: () => {
      toast.success(m['admin.directory.tools.created']());
      setCreateOpen(false);
      createForm.reset();
      queryClient.invalidateQueries({ queryKey: ['admin-dir-tools'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const editMutation = useMutation({
    mutationFn: (value: Record<string, unknown> & { id: string }) =>
      apiPut('/api/admin/directory/tools', value),
    onSuccess: () => {
      toast.success(m['admin.directory.tools.updated']());
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['admin-dir-tools'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const statusMutation = useMutation({
    mutationFn: (vars: { id: string; status: string }) =>
      apiPut('/api/admin/directory/tools', vars),
    onSuccess: (_d, vars) => {
      toast.success(
        vars.status === 'published'
          ? m['admin.directory.tools.approved']()
          : m['admin.directory.tools.rejected']()
      );
      queryClient.invalidateQueries({ queryKey: ['admin-dir-tools'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const unpublishMutation = useMutation({
    mutationFn: (id: string) =>
      apiPut('/api/admin/directory/tools', { id, forceUnpublish: true }),
    onSuccess: () => {
      toast.success(m['admin.directory.tools.force_unpublished']());
      queryClient.invalidateQueries({ queryKey: ['admin-dir-tools'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiDelete(`/api/admin/directory/tools?id=${id}`),
    onSuccess: () => {
      toast.success(m['admin.directory.tools.deleted']());
      queryClient.invalidateQueries({ queryKey: ['admin-dir-tools'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleReject(row: DirTool) {
    const ok = await confirm({
      title: m['admin.directory.tools.reject_title'](),
      description: m['admin.directory.tools.reject_confirm'](),
      confirmLabel: m['admin.directory.tools.reject'](),
      destructive: true,
    });
    if (!ok) return;
    statusMutation.mutate({ id: row.id, status: 'rejected' });
  }

  async function handleForceUnpublish(row: DirTool) {
    const ok = await confirm({
      title: m['admin.directory.tools.force_unpublish_title'](),
      description: m['admin.directory.tools.force_unpublish_confirm'](),
      confirmLabel: m['admin.directory.tools.force_unpublish'](),
      destructive: true,
    });
    if (!ok) return;
    unpublishMutation.mutate(row.id);
  }

  async function handleDelete(row: DirTool) {
    const ok = await confirm({
      title: m['admin.directory.tools.delete_title'](),
      description: m['admin.directory.tools.delete_confirm'](),
      confirmLabel: m['admin.directory.common.delete'](),
      destructive: true,
    });
    if (!ok) return;
    deleteMutation.mutate(row.id);
  }

  const columns = buildToolColumns({
    onApprove: (id) => statusMutation.mutate({ id, status: 'published' }),
    onReject: handleReject,
    onForceUnpublish: handleForceUnpublish,
    onEdit: setEditingId,
    onDelete: handleDelete,
  });

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {confirmDialog}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {m['admin.directory.tools.title']()}
          </h1>
          <p className="text-muted-foreground">
            {m['admin.directory.tools.description']()}
          </p>
        </div>
        <Button
          onClick={() => {
            createForm.reset(emptyForm);
            setCreateOpen(true);
          }}
          className="gap-2"
        >
          <Plus className="size-4" />
          {m['admin.directory.tools.create']()}
        </Button>
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
            {tDynamic(`admin.directory.tools.tab_${tb}`)}
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
            emptyText={m['admin.directory.tools.empty']()}
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
        title={m['admin.directory.tools.create_title']()}
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
            {renderToolFields(
              createForm,
              categoryOptions.data ?? [],
              tagOptions.data ?? []
            )}
          </DirectoryFormBody>
        </form>
      </DirectoryFormDrawer>

      <DirectoryFormDrawer
        open={!!editingId}
        onOpenChange={(v) => !v && setEditingId(null)}
        title={m['admin.directory.tools.edit_title']()}
      >
        {!editingId ||
        detailQuery.isPending ||
        !detailQuery.data ||
        detailQuery.data.id !== editingId ? (
          <p className="text-muted-foreground px-6 py-8 text-sm">
            {m['admin.loading']()}
          </p>
        ) : (
          <ToolEditForm
            key={editingId}
            initial={valuesFromToolDetail(detailQuery.data)}
            cats={categoryOptions.data ?? []}
            tags={tagOptions.data ?? []}
            saving={editMutation.isPending}
            onCancel={() => setEditingId(null)}
            onSave={async (value) => {
              await editMutation.mutateAsync({
                id: editingId,
                ...toEditPayload(value),
              });
            }}
          />
        )}
      </DirectoryFormDrawer>
    </div>
  );
}

export const Route = createFileRoute('/admin/directory/tools')({
  component: DirectoryToolsPage,
});
