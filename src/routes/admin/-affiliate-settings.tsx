import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

import { tDynamic } from '@/core/i18n/dynamic';
import { getSettings } from '@/modules/config/settings';
import { apiGet, apiPost } from '@/lib/api-client';
import { m } from '@/paraglide/messages.js';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import { fieldTip, SettingField } from './-setting-field';

/**
 * The program's global reward rules, on the affiliates admin page. Reads and
 * writes the same settings as Settings → Users → Affiliates, so it needs the
 * settings permissions (the API checks them).
 */
export function AffiliateSettings({ canWrite }: { canWrite: boolean }) {
  const queryClient = useQueryClient();
  const fields = getSettings().filter((s) => s.group === 'affiliates');
  const [values, setValues] = useState<Record<string, string>>({});

  const configQuery = useQuery({
    queryKey: ['admin-config'],
    queryFn: () => apiGet<Record<string, string>>('/api/admin/config'),
  });

  useEffect(() => {
    if (!configQuery.data) return;
    const next: Record<string, string> = {};
    for (const f of fields)
      next[f.name] = configQuery.data[f.name] ?? f.defaultValue ?? '';
    setValues(next);
    // fields come from a static list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configQuery.data]);

  const save = useMutation({
    mutationFn: () => apiPost('/api/admin/config', values),
    onSuccess: () => {
      toast.success(m['admin.settings.save_success']());
      queryClient.invalidateQueries({ queryKey: ['admin-config'] });
      queryClient.invalidateQueries({ queryKey: ['admin-affiliates'] });
      // The master switch shows/hides public pages and nav entries.
      queryClient.invalidateQueries({ queryKey: ['public-config'] });
    },
    onError: (err: Error) =>
      toast.error(err?.message || m['admin.settings.save_error']()),
  });

  if (configQuery.isPending) {
    return (
      <div className="text-muted-foreground flex justify-center py-12">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }
  if (configQuery.isError) {
    return (
      <p className="text-destructive py-6 text-sm">
        {configQuery.error.message}
      </p>
    );
  }

  return (
    <Card>
      <CardContent className="max-w-2xl space-y-6">
        <p className="text-muted-foreground text-sm">
          {m['admin.affiliates.settings.description']()}
        </p>
        {fields.map((f) => (
          <SettingField
            key={f.name}
            setting={f}
            label={tDynamic(`admin.settings.fields.${f.name}`)}
            placeholder={f.placeholder}
            tip={fieldTip(f.name)}
            value={values[f.name] ?? ''}
            onChange={(v) => setValues((prev) => ({ ...prev, [f.name]: v }))}
          />
        ))}
        <p className="text-muted-foreground text-xs">
          {m['admin.affiliates.settings.footnote']()}
        </p>
        <Button
          className="gap-1.5"
          disabled={!canWrite || save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {m['admin.settings.save']()}
        </Button>
      </CardContent>
    </Card>
  );
}
