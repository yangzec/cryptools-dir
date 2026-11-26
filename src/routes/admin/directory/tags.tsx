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
import { z } from 'zod';

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
import { TextField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import {
  DirectoryFormBody,
  DirectoryFormDrawer,
  DirectoryLocaleSection,
  localeField,
} from './-form-ui';

interface DirTag {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  nameZh: string;
  descriptionZh: string;
  toolCount: number;
  createdAt: string;
}

const PAGE_SIZE = 20;
const schema = z.object({
  slug: z.string(),
  name: z.string().min(1),
  description: z.string(),
  nameZh: z.string(),
  descriptionZh: z.string(),
});
type FormValues = z.infer<typeof schema>;
export const emptyForm: FormValues = {
  slug: '',
  name: '',
  description: '',
  nameZh: '',
  descriptionZh: '',
};

function valuesFromTag(row: DirTag): FormValues {
  return {
    slug: row.slug || '',
    name: row.name || '',
    description: row.description || '',
    nameZh: row.nameZh || '',
    descriptionZh: row.descriptionZh || '',
  };
}

export function toPayload(value: FormValues) {
  return {
    slug: value.slug.trim() || undefined,
    name: value.name.trim(),
    // Always send (incl. '') so clearing EN/ZH copy reaches the API.
    description: value.description.trim(),
    nameZh: value.nameZh.trim(),
    descriptionZh: value.descriptionZh.trim(),
  };
}

/** Edit omits slug — public tag URLs stay stable after create. */
export function toEditPayload(value: FormValues) {
  const { slug: _slug, ...rest } = toPayload(value);
  return rest;
}

function renderFields(form: any, opts?: { lockSlug?: boolean }) {
  const lockSlug = Boolean(opts?.lockSlug);
  return (
    <div className="space-y-4">
      <form.Field name="slug">
        {(field: any) => (
          <TextField
            field={field}
            label={m['admin.directory.common.slug']()}
            placeholder="agent"
            disabled={lockSlug}
          />
        )}
      </form.Field>
      {lockSlug ? (
        <p className="text-muted-foreground text-xs">
          {m['admin.directory.common.slug_locked_hint']()}
        </p>
      ) : null}
      <DirectoryLocaleSection>
        {(locale) => (
          <>
            <form.Field name={localeField('name', locale)}>
              {(field: any) => (
                <TextField
                  field={field}
                  label={m['admin.directory.common.name']()}
                  placeholder={locale === 'en' ? 'Agent' : '智能体'}
                />
              )}
            </form.Field>
            <form.Field name={localeField('description', locale)}>
              {(field: any) => (
                <TextField
                  field={field}
                  label={m['admin.directory.common.description']()}
                />
              )}
            </form.Field>
          </>
        )}
      </DirectoryLocaleSection>
    </div>
  );
}

function TagEditForm({
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
        {renderFields(form, { lockSlug: true })}
      </DirectoryFormBody>
    </form>
  );
}

function DirectoryTagsPage() {
  const queryClient = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<DirTag | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [debouncedSearch]);

  const listQuery = useQuery({
    queryKey: ['admin-dir-tags', page, debouncedSearch],
    queryFn: () =>
      apiGet<PageResult<DirTag>>(
        pageQuery('/api/admin/directory/tags', {
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
  function openEdit(row: DirTag) {
    setEditing(row);
  }

  const createMutation = useMutation({
    mutationFn: (value: ReturnType<typeof toPayload>) =>
      apiPost('/api/admin/directory/tags', value),
    onSuccess: () => {
      toast.success(m['admin.directory.tags.created']());
      setCreateOpen(false);
      createForm.reset();
      queryClient.invalidateQueries({ queryKey: ['admin-dir-tags'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const editMutation = useMutation({
    mutationFn: (value: ReturnType<typeof toEditPayload> & { id: string }) =>
      apiPut('/api/admin/directory/tags', value),
    onSuccess: () => {
      toast.success(m['admin.directory.tags.updated']());
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['admin-dir-tags'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/admin/directory/tags?id=${id}`),
    onSuccess: () => {
      toast.success(m['admin.directory.tags.deleted']());
      queryClient.invalidateQueries({ queryKey: ['admin-dir-tags'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleDelete(row: DirTag) {
    const ok = await confirm({
      title: m['admin.directory.tags.delete_title'](),
      description: m['admin.directory.tags.delete_confirm']({
        count: row.toolCount || 0,
      }),
      confirmLabel: m['admin.directory.common.delete'](),
      destructive: true,
    });
    if (!ok) return;
    deleteMutation.mutate(row.id);
  }

  const columns: Column<DirTag>[] = [
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
      header: m['admin.directory.tags.tools'](),
      cell: (r) => (
        <span className="text-sm tabular-nums">{r.toolCount ?? 0}</span>
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
            {m['admin.directory.tags.title']()}
          </h1>
          <p className="text-muted-foreground">
            {m['admin.directory.tags.description']()}
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
          {m['admin.directory.tags.create']()}
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
            emptyText={m['admin.directory.tags.empty']()}
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
        title={m['admin.directory.tags.create_title']()}
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
            {renderFields(createForm)}
          </DirectoryFormBody>
        </form>
      </DirectoryFormDrawer>

      <DirectoryFormDrawer
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        title={m['admin.directory.tags.edit_title']()}
      >
        {editing ? (
          <TagEditForm
            key={editing.id}
            initial={valuesFromTag(editing)}
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

export const Route = createFileRoute('/admin/directory/tags')({
  component: DirectoryTagsPage,
});
