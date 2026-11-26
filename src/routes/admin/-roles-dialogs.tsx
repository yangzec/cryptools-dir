import { m } from '@/paraglide/messages.js';
import { TextField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import type { Permission, Role } from './-roles-shared';

export function RolesDialogs({
  editingRole,
  setEditingRole,
  deletingRole,
  setDeletingRole,
  permRole,
  setPermRole,
  editForm,
  editMutation,
  deleteMutation,
  allPermissions,
  assignedPermIds,
  togglePermission,
  handleSavePermissions,
  savePermissionsMutation,
}: {
  editingRole: Role | null;
  setEditingRole: (v: Role | null) => void;
  deletingRole: Role | null;
  setDeletingRole: (v: Role | null) => void;
  permRole: Role | null;
  setPermRole: (v: Role | null) => void;
  editForm: any;
  editMutation: { isPending: boolean };
  deleteMutation: { isPending: boolean; mutate: (id: string) => void };
  allPermissions: Permission[];
  assignedPermIds: Set<string>;
  togglePermission: (id: string) => void;
  handleSavePermissions: () => void;
  savePermissionsMutation: { isPending: boolean };
}) {
  return (
    <>
      {/* Edit Dialog */}
      <Dialog
        open={!!editingRole}
        onOpenChange={(v) => !v && setEditingRole(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m['admin.roles.edit_title']()}</DialogTitle>
            <DialogDescription>
              {m['admin.roles.edit_description']()}
            </DialogDescription>
          </DialogHeader>
          <form
            key={editingRole?.id ?? 'edit'}
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              editForm.handleSubmit();
            }}
          >
            <div className="space-y-4 py-4">
              <editForm.Field name="name">
                {(field: any) => (
                  <TextField
                    field={field}
                    label={m['admin.roles.name_field']()}
                    placeholder={m['admin.roles.name_placeholder']()}
                  />
                )}
              </editForm.Field>
              <editForm.Field name="title">
                {(field: any) => (
                  <TextField
                    field={field}
                    label={m['admin.roles.title_field']()}
                    placeholder={m['admin.roles.title_placeholder']()}
                  />
                )}
              </editForm.Field>
              <editForm.Field name="description">
                {(field: any) => (
                  <TextField
                    field={field}
                    label={m['admin.roles.description_field']()}
                    placeholder={m['admin.roles.description_placeholder']()}
                  />
                )}
              </editForm.Field>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingRole(null)}
              >
                {m['admin.roles.cancel']()}
              </Button>
              <Button type="submit" disabled={editMutation.isPending}>
                {m['admin.roles.save']()}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog
        open={!!deletingRole}
        onOpenChange={(v) => !v && setDeletingRole(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m['admin.roles.delete_title']()}</DialogTitle>
            <DialogDescription>
              {m['admin.roles.delete_confirm']()}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingRole(null)}>
              {m['admin.roles.cancel']()}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() =>
                deletingRole && deleteMutation.mutate(deletingRole.id)
              }
            >
              {m['admin.roles.confirm_delete']()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permissions Dialog */}
      <Dialog open={!!permRole} onOpenChange={(v) => !v && setPermRole(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {m['admin.roles.manage_permissions_title']()}
            </DialogTitle>
            <DialogDescription>
              {m['admin.roles.manage_permissions_description']()}
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleSavePermissions();
            }}
          >
            <div className="max-h-64 space-y-3 overflow-y-auto py-4">
              {allPermissions.map((perm) => (
                <label
                  key={perm.id}
                  className="flex cursor-pointer items-center gap-3"
                >
                  <Checkbox
                    checked={assignedPermIds.has(perm.id)}
                    onCheckedChange={() => togglePermission(perm.id)}
                  />
                  <div>
                    <div className="text-sm font-medium">{perm.title}</div>
                    <div className="text-muted-foreground font-mono text-xs">
                      {perm.code}
                    </div>
                  </div>
                </label>
              ))}
              {allPermissions.length === 0 && (
                <p className="text-muted-foreground py-4 text-center text-sm">
                  {m['admin.permissions.no_permissions']()}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPermRole(null)}
              >
                {m['admin.roles.cancel']()}
              </Button>
              <Button
                type="submit"
                disabled={savePermissionsMutation.isPending}
              >
                {m['admin.roles.save']()}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
