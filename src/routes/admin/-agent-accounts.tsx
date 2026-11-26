import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Link } from '@/core/i18n/navigation';
import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  type PageResult,
} from '@/lib/api-client';
import { formatDateTime } from '@/lib/time';
import { m } from '@/paraglide/messages.js';
import { useConfirm } from '@/hooks/use-confirm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import {
  AgentDeleteDialog,
  AgentEditDialog,
  type Role,
} from './-agent-account-dialogs';
import { AgentKeysDialog, keyState, type Agent } from './-agent-account-keys';

const AGENTS_KEY = ['admin-agent-accounts'];

/**
 * Agent service accounts: each is an `api`-type user whose permissions are
 * its RBAC roles, holding one or more admin API keys.
 */
export function AgentAccounts({ onConnect }: { onConnect?: () => void }) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: AGENTS_KEY });
  const { confirm, dialog } = useConfirm();

  const agentsQuery = useQuery({
    queryKey: AGENTS_KEY,
    queryFn: () => apiGet<Agent[]>('/api/admin/agent/accounts'),
  });
  const rolesQuery = useQuery({
    queryKey: ['admin-agent-roles'],
    queryFn: () => apiGet<PageResult<Role>>('/api/admin/roles?pageSize=100'),
  });
  const agents = agentsQuery.data ?? [];
  const roles = rolesQuery.data?.items ?? [];

  // Create / edit agent
  const [editing, setEditing] = useState<Agent | 'new' | null>(null);
  const [name, setName] = useState('');
  const [roleIds, setRoleIds] = useState<string[]>([]);
  function openEditor(agent: Agent | 'new') {
    setEditing(agent);
    setName(agent === 'new' ? '' : agent.name);
    setRoleIds(agent === 'new' ? [] : agent.roles.map((r) => r.id));
  }
  const saveMutation = useMutation({
    // Resolves to the new agent's id on create, null on edit.
    mutationFn: async (): Promise<string | null> => {
      if (editing === 'new') {
        const created = await apiPost<{ id: string }>(
          '/api/admin/agent/accounts',
          { name: name.trim(), roleIds }
        );
        return created.id;
      }
      await apiPatch('/api/admin/agent/accounts', {
        id: (editing as Agent).id,
        name: name.trim(),
        roleIds,
      });
      return null;
    },
    onSuccess: (newId) => {
      setEditing(null);
      refresh();
      toast.success(m['admin.agent.saved']());
      // A new agent is useless without a key — go straight to issuing one.
      if (newId) setKeysFor(newId);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Delete agent
  const [deleting, setDeleting] = useState<Agent | null>(null);
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiDelete(`/api/admin/agent/accounts?id=${encodeURIComponent(id)}`),
    onSuccess: () => {
      setDeleting(null);
      refresh();
      toast.success(m['admin.agent.deleted']());
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Keys dialog
  const [keysFor, setKeysFor] = useState<string | null>(null);
  const keysAgent = agents.find((a) => a.id === keysFor) ?? null;
  const [keyName, setKeyName] = useState('');
  const [expiryDays, setExpiryDays] = useState<string>('30');
  const [createdKey, setCreatedKey] = useState('');
  const createKeyMutation = useMutation({
    mutationFn: () =>
      apiPost<{ token: string }>('/api/admin/agent/keys', {
        agentId: keysFor,
        name: keyName.trim() || 'default',
        expiresAt:
          expiryDays === 'never'
            ? null
            : new Date(
                Date.now() + Number(expiryDays) * 86400000
              ).toISOString(),
      }),
    onSuccess: (data) => {
      setCreatedKey(data.token);
      setKeyName('');
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const revokeMutation = useMutation({
    mutationFn: (id: string) =>
      apiDelete(`/api/admin/agent/keys?id=${encodeURIComponent(id)}`),
    onSuccess: () => {
      toast.success(m['admin.agent.revoked']());
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  function closeKeys() {
    setKeysFor(null);
    setCreatedKey('');
    setExpiryDays('30');
  }

  return (
    <Card>
      {dialog}
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="min-w-0 flex-1 space-y-1.5">
          <CardTitle className="text-base">
            {m['admin.agent.accounts']()}
          </CardTitle>
          <CardDescription>
            {m['admin.agent.accounts_hint']()}{' '}
            <Link
              href="/admin/roles"
              className="text-primary underline-offset-4 hover:underline"
            >
              {m['admin.agent.manage_roles']()}
            </Link>
          </CardDescription>
        </div>
        <Button
          size="sm"
          className="shrink-0"
          onClick={() => openEditor('new')}
        >
          <Plus className="size-4" />
          {m['admin.agent.create_agent']()}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{m['admin.agent.agent_name']()}</TableHead>
                <TableHead>{m['admin.agent.agent_roles']()}</TableHead>
                <TableHead>{m['admin.agent.agent_keys']()}</TableHead>
                <TableHead>{m['admin.agent.agent_last_used']()}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map((agent) => {
                const active = agent.keys.filter(
                  (k) => keyState(k) === 'active'
                );
                const lastUsed = agent.keys
                  .map((k) => k.lastUsedAt)
                  .filter(Boolean)
                  .sort()
                  .pop();
                return (
                  <TableRow key={agent.id}>
                    <TableCell className="font-medium">{agent.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {agent.roles.length ? (
                          agent.roles.map((r) => (
                            <Badge key={r.id} variant="secondary">
                              {r.title || r.name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            {m['admin.agent.no_roles']()}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {m['admin.agent.active_keys']({ count: active.length })}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {lastUsed ? formatDateTime(lastUsed) : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setKeysFor(agent.id)}
                        >
                          <KeyRound className="size-3.5" />
                          {m['admin.agent.keys']()}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label={m['admin.agent.edit']()}
                          onClick={() => openEditor(agent)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label={m['admin.agent.delete']()}
                          onClick={() => setDeleting(agent)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {agentsQuery.data?.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-muted-foreground h-20 text-center"
                  >
                    {m['admin.agent.no_agents']()}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <AgentEditDialog
        editing={editing}
        onClose={() => setEditing(null)}
        name={name}
        setName={setName}
        roleIds={roleIds}
        setRoleIds={setRoleIds}
        roles={roles}
        saveMutation={saveMutation}
      />

      <AgentKeysDialog
        keysAgent={keysAgent}
        open={!!keysFor}
        onClose={closeKeys}
        onConnect={onConnect}
        keyName={keyName}
        setKeyName={setKeyName}
        expiryDays={expiryDays}
        setExpiryDays={setExpiryDays}
        createdKey={createdKey}
        createKeyMutation={createKeyMutation}
        revokeMutation={revokeMutation}
        confirm={confirm}
      />

      <AgentDeleteDialog
        deleting={deleting}
        onClose={() => setDeleting(null)}
        deleteMutation={deleteMutation}
      />
    </Card>
  );
}
