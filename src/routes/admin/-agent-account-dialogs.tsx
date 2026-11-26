import type { Dispatch, SetStateAction } from 'react';

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
import { Label } from '@/components/ui/label';

import type { Agent } from './-agent-account-keys';

export interface Role {
  id: string;
  name: string;
  title: string;
  description?: string | null;
}

export function AgentEditDialog({
  editing,
  onClose,
  name,
  setName,
  roleIds,
  setRoleIds,
  roles,
  saveMutation,
}: {
  editing: Agent | 'new' | null;
  onClose: () => void;
  name: string;
  setName: (v: string) => void;
  roleIds: string[];
  setRoleIds: Dispatch<SetStateAction<string[]>>;
  roles: Role[];
  saveMutation: { mutate: () => void; isPending: boolean };
}) {
  return (
    <Dialog open={!!editing} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing === 'new'
              ? m['admin.agent.create_agent']()
              : m['admin.agent.edit_agent']()}
          </DialogTitle>
          <DialogDescription>
            {m['admin.agent.agent_form_hint']()}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) saveMutation.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="agent-name">{m['admin.agent.agent_name']()}</Label>
            <Input
              id="agent-name"
              value={name}
              maxLength={100}
              placeholder="Claude Code"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{m['admin.agent.agent_roles']()}</Label>
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border p-3">
              {roles.map((r) => (
                <label
                  key={r.id}
                  className="flex cursor-pointer items-start gap-2 text-sm"
                >
                  <Checkbox
                    className="mt-0.5"
                    checked={roleIds.includes(r.id)}
                    onCheckedChange={(checked) =>
                      setRoleIds((prev) =>
                        checked
                          ? [...prev, r.id]
                          : prev.filter((id) => id !== r.id)
                      )
                    }
                  />
                  <span>
                    <span className="font-medium">{r.title || r.name}</span>{' '}
                    <code className="text-muted-foreground text-xs">
                      {r.name}
                    </code>
                    {r.description && (
                      <span className="text-muted-foreground block text-xs">
                        {r.description}
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={!name.trim() || saveMutation.isPending}
            >
              {m['admin.agent.save']()}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AgentDeleteDialog({
  deleting,
  onClose,
  deleteMutation,
}: {
  deleting: Agent | null;
  onClose: () => void;
  deleteMutation: { mutate: (id: string) => void; isPending: boolean };
}) {
  return (
    <Dialog open={!!deleting} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {m['admin.agent.delete_title']({ name: deleting?.name ?? '' })}
          </DialogTitle>
          <DialogDescription>
            {m['admin.agent.delete_warning']()}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {m['admin.agent.cancel']()}
          </Button>
          <Button
            variant="destructive"
            disabled={deleteMutation.isPending}
            onClick={() => deleting && deleteMutation.mutate(deleting.id)}
          >
            {m['admin.agent.delete']()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
