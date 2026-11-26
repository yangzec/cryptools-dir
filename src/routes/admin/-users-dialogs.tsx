import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiDelete, apiGet, apiGetAll, apiPost } from '@/lib/api-client';
import { m } from '@/paraglide/messages.js';
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
import { Input } from '@/components/ui/input';

export interface User {
  id: string;
  name: string;
  email: string;
  image: string | null;
  createdAt: string;
  credits: number;
  utmSource: string;
  ip: string;
  roles: { name: string; title: string }[];
}

interface RoleInfo {
  id: string;
  name: string;
  title: string;
}

interface UserRoleInfo {
  roleId: string;
  roleName: string;
  roleTitle: string;
}

export function ManageRolesDialog({
  user,
  onClose,
}: {
  user: User | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const allRolesQuery = useQuery({
    queryKey: ['admin-roles-all'],
    queryFn: () => apiGetAll<RoleInfo>('/api/admin/roles'),
    enabled: !!user,
  });

  const userRolesQuery = useQuery({
    queryKey: ['user-roles', user?.id],
    queryFn: () =>
      apiGet<UserRoleInfo[]>(`/api/admin/roles?userId=${user!.id}`),
    enabled: !!user,
  });

  const allRoles = allRolesQuery.data ?? [];
  const userRoleIds = new Set((userRolesQuery.data ?? []).map((r) => r.roleId));

  const assignRoleMutation = useMutation({
    mutationFn: (roleId: string) =>
      apiPost('/api/admin/roles/assign', {
        userId: user!.id,
        roleId,
      }),
    onSuccess: () => {
      toast.success(m['admin.users.role_assigned']());
      queryClient.invalidateQueries({
        queryKey: ['user-roles', user?.id],
      });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeRoleMutation = useMutation({
    mutationFn: (roleId: string) =>
      apiDelete(`/api/admin/roles/assign?userId=${user!.id}&roleId=${roleId}`),
    onSuccess: () => {
      toast.success(m['admin.users.role_removed']());
      queryClient.invalidateQueries({
        queryKey: ['user-roles', user?.id],
      });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggling = assignRoleMutation.isPending || removeRoleMutation.isPending;

  function toggleRole(roleId: string) {
    if (!user || toggling) return;
    if (userRoleIds.has(roleId)) {
      removeRoleMutation.mutate(roleId);
    } else {
      assignRoleMutation.mutate(roleId);
    }
  }

  return (
    <Dialog open={!!user} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m['admin.users.manage_roles_title']()}</DialogTitle>
          <DialogDescription>
            {m['admin.users.manage_roles_description']()}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-64 space-y-3 overflow-y-auto py-4">
          {allRoles.map((r) => (
            <label
              key={r.id}
              className="flex cursor-pointer items-center gap-3"
            >
              <Checkbox
                checked={userRoleIds.has(r.id)}
                onCheckedChange={() => toggleRole(r.id)}
                disabled={toggling}
              />
              <div>
                <div className="text-sm font-medium">{r.title}</div>
                <div className="text-muted-foreground font-mono text-xs">
                  {r.name}
                </div>
              </div>
            </label>
          ))}
          {allRoles.length === 0 && (
            <p className="text-muted-foreground py-4 text-center text-sm">
              {m['admin.roles.no_roles']()}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {m['admin.roles.cancel']()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SetPasswordDialog({
  user,
  onClose,
}: {
  user: User | null;
  onClose: () => void;
}) {
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    if (user) setNewPassword('');
  }, [user]);

  const passwordMutation = useMutation({
    mutationFn: (vars: { userId: string; password: string }) =>
      apiPost('/api/admin/users/password', vars),
    onSuccess: () => {
      toast.success(m['admin.users.password_updated']());
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submitPassword() {
    if (!user) return;
    if (newPassword.length < 8) {
      toast.error(m['admin.users.password_too_short']());
      return;
    }
    passwordMutation.mutate({ userId: user.id, password: newPassword });
  }

  return (
    <Dialog open={!!user} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m['admin.users.set_password_title']()}</DialogTitle>
          <DialogDescription>
            {user
              ? m['admin.users.set_password_description']({
                  name: user.name || user.email,
                })
              : ''}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submitPassword();
          }}
        >
          <div className="space-y-1.5 py-2">
            <label className="text-sm font-medium">
              {m['admin.users.new_password_label']()}
            </label>
            <Input
              type="text"
              autoComplete="off"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={m['admin.users.new_password_placeholder']()}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {m['admin.roles.cancel']()}
            </Button>
            <Button type="submit" disabled={passwordMutation.isPending}>
              {passwordMutation.isPending
                ? m['admin.users.credits_submitting']()
                : m['admin.users.password_submit']()}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ManageCreditsDialog({
  user,
  onClose,
}: {
  user: User | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [creditsAction, setCreditsAction] = useState<'grant' | 'deduct'>(
    'grant'
  );
  const [creditsAmount, setCreditsAmount] = useState('');
  const [creditsDesc, setCreditsDesc] = useState('');

  useEffect(() => {
    if (user) {
      setCreditsAction('grant');
      setCreditsAmount('');
      setCreditsDesc('');
    }
  }, [user]);

  const creditsMutation = useMutation({
    mutationFn: (vars: {
      userId: string;
      action: 'grant' | 'deduct';
      credits: number;
      description?: string;
    }) => apiPost<{ balance: number }>('/api/admin/users/credits', vars),
    onSuccess: (_data, vars) => {
      toast.success(
        vars.action === 'grant'
          ? m['admin.users.credits_granted']()
          : m['admin.users.credits_deducted']()
      );
      onClose();
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user', vars.userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submitCredits() {
    if (!user) return;
    const amount = Number(creditsAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error(m['admin.users.credits_invalid_amount']());
      return;
    }
    creditsMutation.mutate({
      userId: user.id,
      action: creditsAction,
      credits: amount,
      description: creditsDesc || undefined,
    });
  }

  return (
    <Dialog open={!!user} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m['admin.users.manage_credits_title']()}</DialogTitle>
          <DialogDescription>
            {user
              ? m['admin.users.manage_credits_for']({
                  name: user.name || user.email,
                  balance: user.credits.toLocaleString(),
                })
              : ''}
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submitCredits();
          }}
        >
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCreditsAction('grant')}
                className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                  creditsAction === 'grant'
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border hover:bg-muted'
                }`}
              >
                {m['admin.users.credits_action_grant']()}
              </button>
              <button
                type="button"
                onClick={() => setCreditsAction('deduct')}
                className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                  creditsAction === 'deduct'
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border hover:bg-muted'
                }`}
              >
                {m['admin.users.credits_action_deduct']()}
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {m['admin.users.credits_amount_label']()}
              </label>
              <Input
                type="number"
                min="1"
                value={creditsAmount}
                onChange={(e) => setCreditsAmount(e.target.value)}
                placeholder="0"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {m['admin.users.credits_desc_label']()}
              </label>
              <Input
                value={creditsDesc}
                onChange={(e) => setCreditsDesc(e.target.value)}
                placeholder={m['admin.users.credits_desc_placeholder']()}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {m['admin.roles.cancel']()}
            </Button>
            <Button type="submit" disabled={creditsMutation.isPending}>
              {creditsMutation.isPending
                ? m['admin.users.credits_submitting']()
                : m['admin.users.credits_submit']()}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
