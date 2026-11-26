import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Copy, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { apiDelete, apiGet, apiPost, apiPut } from '@/lib/api-client';
import { m } from '@/paraglide/messages.js';
import { useConfirm } from '@/hooks/use-confirm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { FeatureGate } from '../-feature-gate';
import {
  affiliateErrorMessage,
  BackToAffiliates,
  copyText,
  inviteLinkOf,
} from './-shared';

type InviteCode = {
  id: string;
  code: string;
  isDefault: boolean;
};

type InviteCodesResponse = {
  affiliate: { approved: boolean } | null;
  inviteCodes: InviteCode[];
  inviteParam?: string;
};

const INVITE_CODE_PATTERN = /^[A-Za-z0-9_-]{3,32}$/;

function InviteLinksPage() {
  const queryClient = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InviteCode | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [formError, setFormError] = useState('');

  const query = useQuery({
    queryKey: ['affiliate-invite-codes'],
    queryFn: () => apiGet<InviteCodesResponse>('/api/affiliates/invite-codes'),
  });
  const affiliate = query.data?.affiliate;
  const inviteCodes = query.data?.inviteCodes ?? [];

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['affiliate-invite-codes'] });
    queryClient.invalidateQueries({ queryKey: ['affiliates'] });
  };

  const openForm = (row: InviteCode | null) => {
    setEditing(row);
    setInviteCode(row?.code ?? '');
    setFormError('');
    setFormOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = { inviteCode: inviteCode.trim() };
      return editing
        ? apiPut('/api/affiliates/invite-codes', { id: editing.id, ...payload })
        : apiPost('/api/affiliates/invite-codes', payload);
    },
    onSuccess: () => {
      toast.success(m['affiliates.links.saved']());
      setFormOpen(false);
      refresh();
    },
    onError: (e: Error) => {
      const message = affiliateErrorMessage(e.message);
      setFormError(message);
      toast.error(message);
    },
  });

  const defaultMutation = useMutation({
    mutationFn: (id: string) =>
      apiPut('/api/affiliates/invite-codes', { id, setDefault: true }),
    onSuccess: () => {
      toast.success(m['affiliates.links.default_saved']());
      refresh();
    },
    onError: (e: Error) => toast.error(affiliateErrorMessage(e.message)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiDelete(`/api/affiliates/invite-codes?id=${encodeURIComponent(id)}`),
    onSuccess: () => {
      toast.success(m['affiliates.links.deleted']());
      refresh();
    },
    onError: (e: Error) => toast.error(affiliateErrorMessage(e.message)),
  });

  async function handleDelete(row: InviteCode) {
    const ok = await confirm({
      title: m['affiliates.links.delete_title'](),
      description: m['affiliates.links.delete_confirm']({ code: row.code }),
      confirmLabel: m['affiliates.delete'](),
      destructive: true,
    });
    if (ok) deleteMutation.mutate(row.id);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!INVITE_CODE_PATTERN.test(inviteCode.trim())) {
      setFormError(m['affiliates.errors.invalid_invite_code']());
      return;
    }
    setFormError('');
    saveMutation.mutate();
  }

  if (query.isPending) {
    return <div className="text-muted-foreground p-6">…</div>;
  }

  if (!affiliate?.approved) {
    return (
      <div className="space-y-4 p-6">
        <BackToAffiliates />
        <p className="text-muted-foreground text-sm">
          {query.isError
            ? affiliateErrorMessage(query.error?.message ?? '')
            : m['affiliates.errors.not_approved']()}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 md:max-w-3xl">
      <BackToAffiliates />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {m['affiliates.links.title']()}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {m['affiliates.links.description']()}
          </p>
        </div>
        <Button onClick={() => openForm(null)} className="gap-2">
          <Plus className="size-4" />
          {m['affiliates.links.new']()}
        </Button>
      </div>

      {inviteCodes.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-sm">
            {m['affiliates.links.empty']()}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {inviteCodes.map((row) => {
            const link = inviteLinkOf(row.code, query.data?.inviteParam);
            return (
              <Card key={row.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <CardTitle className="font-mono text-lg">
                        {row.code}
                      </CardTitle>
                      {row.isDefault ? (
                        <Badge variant="secondary">
                          {m['affiliates.default_badge']()}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!row.isDefault ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          disabled={defaultMutation.isPending}
                          onClick={() => defaultMutation.mutate(row.id)}
                        >
                          <Star className="size-3.5" />
                          {m['affiliates.set_default']()}
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => openForm(row)}
                      >
                        <Pencil className="size-3.5" />
                        {m['affiliates.edit']()}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="gap-1.5"
                        disabled={deleteMutation.isPending}
                        onClick={() => handleDelete(row)}
                      >
                        <Trash2 className="size-3.5" />
                        {m['affiliates.delete']()}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="bg-muted/50 flex items-center gap-2 rounded-md border px-3 py-1.5">
                    <span className="min-w-0 flex-1 truncate font-mono text-sm">
                      {link}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5"
                      onClick={() =>
                        copyText(link, m['affiliates.link.copied']())
                      }
                    >
                      <Copy className="size-3.5" />
                      {m['affiliates.link.copy']()}
                    </Button>
                  </div>
                  {row.isDefault ? (
                    <p className="text-muted-foreground text-xs">
                      {m['affiliates.links.default_tip']()}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <DialogHeader>
              <DialogTitle>
                {editing
                  ? m['affiliates.links.edit_title']()
                  : m['affiliates.links.new_title']()}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="invite-code">
                {m['affiliates.links.code_label']()}
              </Label>
              <Input
                id="invite-code"
                value={inviteCode}
                maxLength={32}
                onChange={(e) => {
                  setInviteCode(e.target.value);
                  setFormError('');
                }}
                placeholder={m['affiliates.links.code_placeholder']()}
              />
              <p className="text-muted-foreground text-xs">
                {m['affiliates.links.code_tip']()}
              </p>
              {inviteCode.trim() ? (
                <p className="text-muted-foreground truncate font-mono text-xs">
                  {inviteLinkOf(inviteCode.trim(), query.data?.inviteParam)}
                </p>
              ) : null}
            </div>

            {formError ? (
              <p className="text-destructive text-sm">{formError}</p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
              >
                {m['affiliates.cancel']()}
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? '…' : m['affiliates.save']()}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </div>
  );
}

export const Route = createFileRoute('/settings/affiliates/links')({
  component: () => (
    <FeatureGate feature="affiliates">
      <InviteLinksPage />
    </FeatureGate>
  ),
});
