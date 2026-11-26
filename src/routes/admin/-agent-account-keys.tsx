import { Plus } from 'lucide-react';

import { formatDateTime } from '@/lib/time';
import { m } from '@/paraglide/messages.js';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { CopyButton } from './-copy-button';

export interface AgentKey {
  id: string;
  name: string;
  keyPrefix: string;
  status: string;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
}

export interface Agent {
  id: string;
  name: string;
  createdAt: string;
  roles: { id: string; name: string; title: string }[];
  keys: AgentKey[];
}

export const EXPIRY_DAYS = ['7', '30', '90', '365', 'never'] as const;

export function expiryLabel(d: string) {
  return d === 'never'
    ? m['admin.agent.never_expires']()
    : m['admin.agent.days']({ count: d });
}

export function keyState(k: AgentKey): 'active' | 'expired' | 'revoked' {
  if (k.status !== 'active') return 'revoked';
  if (k.expiresAt && new Date(k.expiresAt) <= new Date()) return 'expired';
  return 'active';
}

export function AgentKeysDialog({
  keysAgent,
  open,
  onClose,
  onConnect,
  keyName,
  setKeyName,
  expiryDays,
  setExpiryDays,
  createdKey,
  createKeyMutation,
  revokeMutation,
  confirm,
}: {
  keysAgent: Agent | null;
  open: boolean;
  onClose: () => void;
  onConnect?: () => void;
  keyName: string;
  setKeyName: (v: string) => void;
  expiryDays: string;
  setExpiryDays: (v: string) => void;
  createdKey: string;
  createKeyMutation: { mutate: () => void; isPending: boolean };
  revokeMutation: { mutate: (id: string) => void; isPending: boolean };
  confirm: (opts: {
    title: string;
    description: string;
    confirmLabel: string;
    destructive?: boolean;
  }) => Promise<boolean>;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {m['admin.agent.keys_of']({ name: keysAgent?.name ?? '' })}
          </DialogTitle>
          <DialogDescription>{m['admin.agent.keys_hint']()}</DialogDescription>
        </DialogHeader>

        {createdKey ? (
          <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {m['admin.agent.created_warning']()}
            </p>
            <div className="bg-background flex items-center rounded-md pl-3">
              <code className="min-w-0 flex-1 py-2 text-xs break-all">
                {createdKey}
              </code>
              <CopyButton value={createdKey} />
            </div>
            {onConnect && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onClose();
                  onConnect();
                }}
              >
                {m['admin.agent.next_connect']()}
              </Button>
            )}
          </div>
        ) : (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              createKeyMutation.mutate();
            }}
          >
            {/* flex gap, not space-y: Base UI's Select appends a hidden
                input, and space-y would push a margin under the trigger. */}
            <div className="flex min-w-40 flex-1 flex-col gap-1.5">
              <Label htmlFor="key-name">{m['admin.agent.key_name']()}</Label>
              <Input
                id="key-name"
                value={keyName}
                maxLength={100}
                placeholder="default"
                onChange={(e) => setKeyName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{m['admin.agent.token_expires']()}</Label>
              <Select
                items={EXPIRY_DAYS.map((d) => ({
                  value: d,
                  label: expiryLabel(d),
                }))}
                value={expiryDays}
                onValueChange={(v) => v && setExpiryDays(String(v))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPIRY_DAYS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {expiryLabel(d)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={createKeyMutation.isPending}>
              <Plus className="size-4" />
              {m['admin.agent.issue_key']()}
            </Button>
            {expiryDays === 'never' && (
              <p className="w-full rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                {m['admin.agent.never_warning']()}
              </p>
            )}
          </form>
        )}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{m['admin.agent.key_name']()}</TableHead>
                <TableHead>{m['admin.agent.token_prefix']()}</TableHead>
                <TableHead>{m['admin.agent.token_expires']()}</TableHead>
                <TableHead>{m['admin.agent.token_last_used']()}</TableHead>
                <TableHead>{m['admin.agent.token_status']()}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(keysAgent?.keys ?? []).map((k) => {
                const state = keyState(k);
                return (
                  <TableRow key={k.id}>
                    <TableCell>{k.name}</TableCell>
                    <TableCell>
                      <code className="text-xs">{k.keyPrefix}…</code>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {k.expiresAt
                        ? formatDateTime(k.expiresAt)
                        : m['admin.agent.never_expires']()}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {k.lastUsedAt ? formatDateTime(k.lastUsedAt) : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={state === 'active' ? 'default' : 'secondary'}
                      >
                        {state === 'active'
                          ? m['admin.agent.status_active']()
                          : state === 'expired'
                            ? m['admin.agent.status_expired']()
                            : m['admin.agent.status_revoked']()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {state === 'active' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={revokeMutation.isPending}
                          onClick={async () => {
                            if (
                              await confirm({
                                title: m['admin.agent.revoke'](),
                                description: m['admin.agent.revoke_warning'](),
                                confirmLabel: m['admin.agent.revoke'](),
                                destructive: true,
                              })
                            )
                              revokeMutation.mutate(k.id);
                          }}
                        >
                          {m['admin.agent.revoke']()}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {keysAgent && keysAgent.keys.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-muted-foreground h-16 text-center"
                  >
                    {m['admin.agent.no_tokens']()}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {m['admin.agent.done']()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
