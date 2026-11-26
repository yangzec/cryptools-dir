import { useEffect, useState } from 'react';
import { useForm } from '@tanstack/react-form';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { KeyRound, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  apiDelete,
  apiGet,
  apiGetAll,
  apiPost,
  apiPut,
  pageQuery,
  type PageResult,
} from '@/lib/api-client';
import { m } from '@/paraglide/messages.js';
import { DataTable, type Column } from '@/components/data-table';
import { TextField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

import { RolesDialogs } from './-roles-dialogs';
import {
  emptyForm,
  PAGE_SIZE,
  roleSchema,
  type Permission,
  type Role,
  type RoleForm,
} from './-roles-shared';

export function RolesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);

  // Permissions dialog
  const [permRole, setPermRole] = useState<Role | null>(null);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [assignedPermIds, setAssignedPermIds] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const listQuery = useQuery({
    queryKey: ['admin-roles', page, debouncedSearch],
    queryFn: () =>
      apiGet<PageResult<Role>>(
        pageQuery('/api/admin/roles', {
          page,
          pageSize: PAGE_SIZE,
          search: debouncedSearch,
        })
      ),
    placeholderData: keepPreviousData,
  });

  const createForm = useForm({
    defaultValues: emptyForm,
    validators: { onSubmit: roleSchema },
    onSubmit: async ({ value }) => {
      await createMutation.mutateAsync(value);
    },
  });

  const editForm = useForm({
    defaultValues: emptyForm,
    validators: { onSubmit: roleSchema },
    onSubmit: async ({ value }) => {
      if (!editingRole) return;
      await editMutation.mutateAsync({ id: editingRole.id, ...value });
    },
  });

  const createMutation = useMutation({
    mutationFn: (value: RoleForm) => apiPost('/api/admin/roles', value),
    onSuccess: () => {
      toast.success(m['admin.roles.created']());
      setCreateOpen(false);
      createForm.reset();
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editMutation = useMutation({
    mutationFn: (value: RoleForm & { id: string }) =>
      apiPut('/api/admin/roles', value),
    onSuccess: () => {
      toast.success(m['admin.roles.updated']());
      setEditingRole(null);
      editForm.reset();
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/admin/roles?id=${id}`),
    onSuccess: () => {
      toast.success(m['admin.roles.deleted']());
      setDeletingRole(null);
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const savePermissionsMutation = useMutation({
    mutationFn: (vars: { roleId: string; permissionIds: string[] }) =>
      apiPut('/api/admin/roles/permissions', vars),
    onSuccess: () => {
      toast.success(m['admin.roles.permissions_saved']());
      setPermRole(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Reset AFTER the edit Dialog mounts fields (Base UI unmounts while closed).
  useEffect(() => {
    if (!editingRole) return;
    editForm.reset({
      name: editingRole.name,
      title: editingRole.title,
      description: editingRole.description || '',
    });
  }, [editingRole]);

  function openEdit(r: Role) {
    setEditingRole(r);
  }

  // Permissions
  async function openPermissions(r: Role) {
    setPermRole(r);
    try {
      const [perms, assigned] = await Promise.all([
        apiGetAll<Permission>('/api/admin/permissions'),
        apiGet<{ permissionId: string }[]>(
          `/api/admin/roles/permissions?roleId=${encodeURIComponent(r.id)}`
        ),
      ]);
      setAllPermissions(perms);
      setAssignedPermIds(new Set(assigned.map((p) => p.permissionId)));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function togglePermission(permId: string) {
    setAssignedPermIds((prev) => {
      const next = new Set(prev);
      if (next.has(permId)) next.delete(permId);
      else next.add(permId);
      return next;
    });
  }

  function handleSavePermissions() {
    if (!permRole) return;
    savePermissionsMutation.mutate({
      roleId: permRole.id,
      permissionIds: [...assignedPermIds],
    });
  }

  const columns: Column<Role>[] = [
    {
      header: m['admin.roles.name_col'](),
      cell: (r) => <span className="font-mono text-sm">{r.name}</span>,
    },
    {
      header: m['admin.roles.title_col'](),
      cell: (r) => <span className="font-medium">{r.title}</span>,
    },
    {
      header: m['admin.roles.description_col'](),
      cell: (r) => (
        <span className="text-muted-foreground">{r.description || '—'}</span>
      ),
    },
    {
      header: m['admin.roles.actions_col'](),
      className: 'w-[120px]',
      cell: (r) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => openPermissions(r)}
          >
            <KeyRound className="size-3" />
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
            onClick={() => setDeletingRole(r)}
          >
            <Trash2 className="size-3" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{m['admin.roles.title']()}</h1>
          <p className="text-muted-foreground">
            {m['admin.roles.description']()}
          </p>
        </div>
        <Dialog
          open={createOpen}
          onOpenChange={(v) => {
            setCreateOpen(v);
            if (v) createForm.reset({ ...emptyForm });
          }}
        >
          <DialogTrigger className="bg-primary text-primary-foreground hover:bg-primary/80 inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-colors">
            <Plus className="size-4" />
            {m['admin.roles.create_role']()}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{m['admin.roles.create_title']()}</DialogTitle>
              <DialogDescription>
                {m['admin.roles.create_description']()}
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                createForm.handleSubmit();
              }}
            >
              <div className="space-y-4 py-4">
                <createForm.Field name="name">
                  {(field) => (
                    <TextField
                      field={field}
                      label={m['admin.roles.name_field']()}
                      placeholder={m['admin.roles.name_placeholder']()}
                    />
                  )}
                </createForm.Field>
                <createForm.Field name="title">
                  {(field) => (
                    <TextField
                      field={field}
                      label={m['admin.roles.title_field']()}
                      placeholder={m['admin.roles.title_placeholder']()}
                    />
                  )}
                </createForm.Field>
                <createForm.Field name="description">
                  {(field) => (
                    <TextField
                      field={field}
                      label={m['admin.roles.description_field']()}
                      placeholder={m['admin.roles.description_placeholder']()}
                    />
                  )}
                </createForm.Field>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                >
                  {m['admin.roles.cancel']()}
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {m['admin.roles.save']()}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
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
            emptyText={m['admin.roles.no_roles']()}
            search={search}
            onSearchChange={setSearch}
            onRefresh={() => listQuery.refetch()}
            loading={listQuery.isFetching || listQuery.isPending}
          />
        </CardContent>
      </Card>

      <RolesDialogs
        editingRole={editingRole}
        setEditingRole={setEditingRole}
        deletingRole={deletingRole}
        setDeletingRole={setDeletingRole}
        permRole={permRole}
        setPermRole={setPermRole}
        editForm={editForm}
        editMutation={editMutation}
        deleteMutation={deleteMutation}
        allPermissions={allPermissions}
        assignedPermIds={assignedPermIds}
        togglePermission={togglePermission}
        handleSavePermissions={handleSavePermissions}
        savePermissionsMutation={savePermissionsMutation}
      />
    </div>
  );
}
