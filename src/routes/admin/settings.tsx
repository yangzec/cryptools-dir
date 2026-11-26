import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import {
  ChevronDown,
  CircleCheck,
  FlaskConical,
  Link2,
  Save,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { z } from 'zod';

import { tDynamic } from '@/core/i18n/dynamic';
import { envConfigs } from '@/config';
import {
  APPEARANCE_ENABLED_KEY,
  COLOR_MODE_CONFIG_KEY,
  isAppearanceValue,
} from '@/config/appearance';
import {
  getSettingGroups,
  getSettings,
  getSettingTabs,
} from '@/modules/config/settings';
import { getTestSpec } from '@/modules/config/settings-test-specs';
import { apiGet, apiPost } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { getLocale } from '@/paraglide/runtime.js';
import { useAppearance } from '@/hooks/use-appearance';
import { SettingsCardsSkeleton } from '@/components/admin/admin-skeletons';
import { SettingsTestDialog } from '@/components/admin/settings-test-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { SettingsCustomCard } from './-settings-custom';
import {
  ADMIN_APPEARANCE_FIELDS,
  fieldExtra,
  fieldTip,
  INSTANT_SETTINGS,
  productIdsMappingPlaceholder,
  SettingField,
} from './-settings-field';

function AdminSettingsPage() {
  const search = Route.useSearch();
  const placeholders: Record<string, string> = {
    creem_test_amount: m['admin.settings.placeholders.creem_test_amount'](),
    paypal_test_amount: m['admin.settings.placeholders.paypal_test_amount'](),
    alipay_test_amount: m['admin.settings.placeholders.alipay_test_amount'](),
    wechat_test_amount: m['admin.settings.placeholders.wechat_test_amount'](),
    dodo_test_amount: m['admin.settings.placeholders.dodo_test_amount'](),
    dodo_api_key: m['admin.settings.placeholders.dodo_api_key'](),
    creem_product_ids_mapping: productIdsMappingPlaceholder('prod_'),
    waffo_product_ids_mapping: productIdsMappingPlaceholder('PROD_'),
    dodo_product_ids_mapping: productIdsMappingPlaceholder('pdt_'),
  };
  const queryClient = useQueryClient();
  const router = useRouter();
  const [configs, setConfigs] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    const outcome = search.dataany;
    if (!outcome) return;
    if (outcome === 'connected')
      toast.success(m['admin.settings.dataany.connected_toast']());
    else if (outcome === 'denied')
      toast.message(m['admin.settings.dataany.denied_toast']());
    else toast.error(m['admin.settings.dataany.error_toast']());
    router.navigate({
      to: '/admin/settings',
      search: { tab: activeTab },
      replace: true,
    });
  }, [search.dataany]); // eslint-disable-line react-hooks/exhaustive-deps

  const disconnectMutation = useMutation({
    mutationFn: () => apiPost('/api/admin/config', { dataany_website_id: '' }),
    onSuccess: () => {
      toast.success(m['admin.settings.dataany.disconnected_toast']());
      queryClient.invalidateQueries({ queryKey: ['admin-config'] });
      router.invalidate();
    },
    onError: (err) => {
      toast.error(err?.message || m['admin.settings.save_error']());
    },
  });
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [testingGroup, setTestingGroup] = useState<string | null>(null);
  const [customRows, setCustomRows] = useState<
    { key: string; value: string }[]
  >([]);

  function toggleCollapse(name: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const tabs = getSettingTabs();
  const groups = getSettingGroups();
  const settings = getSettings();

  const { data: loadedConfigs, isLoading } = useQuery({
    queryKey: ['admin-config'],
    queryFn: () => apiGet<Record<string, string>>('/api/admin/config'),
  });

  useEffect(() => {
    if (loadedConfigs) setConfigs(loadedConfigs);
  }, [loadedConfigs]);

  const { data: loadedCustom } = useQuery({
    queryKey: ['admin-config-custom'],
    queryFn: () =>
      apiGet<{ key: string; value: string }[]>('/api/admin/config/custom'),
  });

  useEffect(() => {
    if (loadedCustom) setCustomRows(loadedCustom);
  }, [loadedCustom]);

  function handleChange(name: string, value: string) {
    setConfigs((prev) => ({ ...prev, [name]: value }));
    if (INSTANT_SETTINGS.has(name)) instantSaveMutation.mutate({ name, value });
  }

  // Appearance settings save on click and repaint at once. Doesn't refetch
  // admin-config, which would wipe other unsaved edits in the form.
  const { applySiteAppearance } = useAppearance();
  const { setTheme } = useTheme();
  const instantSaveMutation = useMutation({
    mutationFn: ({ name, value }: { name: string; value: string }) =>
      apiPost('/api/admin/config', { [name]: value }),
    onSuccess: (_, { name, value }) => {
      if (name === APPEARANCE_ENABLED_KEY) {
        // Switches the style source (code vs settings); the root loader
        // re-renders <html> from it, keeping other unsaved form edits.
        router.invalidate();
        toast.success(m['admin.settings.applied']());
        return;
      }
      const key = ADMIN_APPEARANCE_FIELDS[name];
      if (key && isAppearanceValue(key, value)) {
        applySiteAppearance(key, value);
      } else if (name === COLOR_MODE_CONFIG_KEY) {
        // Preview it on the admin's own screen too.
        setTheme(value);
        router.invalidate();
      } else {
        router.invalidate();
      }
      queryClient.invalidateQueries({ queryKey: ['public-config'] });
      toast.success(m['admin.settings.applied']());
    },
    onError: (err: any) => {
      toast.error(err?.message || m['admin.settings.save_error']());
    },
  });

  function addCustomRow() {
    setCustomRows((prev) => [...prev, { key: '', value: '' }]);
  }

  function removeCustomRow(index: number) {
    setCustomRows((prev) => prev.filter((_, i) => i !== index));
  }

  function updateCustomRow(
    index: number,
    field: 'key' | 'value',
    value: string
  ) {
    setCustomRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  const saveMutation = useMutation({
    mutationFn: (toSave: Record<string, string>) =>
      apiPost('/api/admin/config', toSave),
    onSuccess: () => {
      toast.success(m['admin.settings.save_success']());
      queryClient.invalidateQueries({ queryKey: ['admin-config'] });
      queryClient.invalidateQueries({ queryKey: ['public-config'] });
      // Root loader carries the site theme; re-run it to repaint.
      router.invalidate();
    },
    onError: (err: any) => {
      toast.error(err?.message || m['admin.settings.save_error']());
    },
  });

  const customSaveMutation = useMutation({
    mutationFn: (rows: { key: string; value: string }[]) =>
      apiPost('/api/admin/config/custom', { configs: rows }),
    onSuccess: () => {
      toast.success(m['admin.settings.save_success']());
      queryClient.invalidateQueries({ queryKey: ['admin-config-custom'] });
      queryClient.invalidateQueries({ queryKey: ['public-config'] });
    },
    onError: (err: any) => {
      toast.error(err?.message || m['admin.settings.save_error']());
    },
  });

  const saving = saveMutation.isPending || customSaveMutation.isPending;

  function handleSave() {
    if (activeTab === 'custom') {
      const rows = customRows
        .map((r) => ({ key: r.key.trim(), value: r.value }))
        .filter((r) => r.key);
      customSaveMutation.mutate(rows);
      return;
    }
    const tabSettings = settings.filter((s) => s.tab === activeTab);
    const toSave: Record<string, string> = {};
    for (const s of tabSettings) {
      if (configs[s.name] !== undefined) {
        toSave[s.name] = configs[s.name];
      }
    }
    saveMutation.mutate(toSave);
  }

  const tabGroups = groups.filter((g) => g.tab === activeTab);
  const tabSettings = settings.filter((s) => s.tab === activeTab);

  return (
    <div className="space-y-6 p-6 lg:max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{m['admin.settings.title']()}</h1>
          <p className="text-muted-foreground">
            {m['admin.settings.description']()}
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="size-4" />
          {saving ? m['admin.settings.saving']() : m['admin.settings.save']()}
        </Button>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Tabs: horizontal scroll strip on small screens, sticky side nav on lg+ */}
        <nav className="border-border -mx-6 flex shrink-0 gap-1 overflow-x-auto overflow-y-hidden border-b px-6 lg:sticky lg:top-6 lg:mx-0 lg:w-48 lg:flex-col lg:overflow-visible lg:border-b-0 lg:px-0">
          {tabs.map((tab) => (
            <button
              key={tab.name}
              onClick={() => setActiveTab(tab.name)}
              aria-current={activeTab === tab.name ? 'page' : undefined}
              className={cn(
                '-mb-px border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                'lg:mb-0 lg:rounded-md lg:border-b-0 lg:px-3 lg:text-left',
                activeTab === tab.name
                  ? 'border-primary text-foreground lg:bg-muted'
                  : 'text-muted-foreground hover:text-foreground lg:hover:bg-muted/50 border-transparent'
              )}
            >
              {tDynamic(`admin.settings.tabs.${tab.name}`)}
            </button>
          ))}
        </nav>

        <div className="min-w-0 flex-1 space-y-6">
          {/* Groups */}
          {isLoading ? (
            <SettingsCardsSkeleton
              cards={Array.from({ length: 4 }, (_, i) => ({
                key: String(i),
                fields: 3,
              }))}
            />
          ) : activeTab === 'custom' ? (
            <SettingsCustomCard
              customRows={customRows}
              onAdd={addCustomRow}
              onRemove={removeCustomRow}
              onUpdate={updateCustomRow}
            />
          ) : (
            tabGroups.map((group) => {
              const groupSettings = tabSettings.filter((s) => {
                if (s.group !== group.name) return false;
                if (
                  s.group === 'appearance' &&
                  s.name !== APPEARANCE_ENABLED_KEY &&
                  configs[APPEARANCE_ENABLED_KEY] !== 'true'
                ) {
                  return false;
                }
                const when = s.showWhen;
                if (when) {
                  const current =
                    configs[when.name] ||
                    tabSettings.find((x) => x.name === when.name)
                      ?.defaultValue ||
                    '';
                  if (current !== when.value) return false;
                }
                return true;
              });
              if (groupSettings.length === 0) return null;

              const testSpec = getTestSpec(group.name);
              return (
                <Card key={group.name}>
                  <CardHeader
                    className="cursor-pointer"
                    onClick={() => toggleCollapse(group.name)}
                  >
                    <div className="flex items-center justify-between">
                      <CardTitle className="select-text">
                        {tDynamic(`admin.settings.groups.${group.name}.title`)}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {testSpec && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTestingGroup(group.name);
                            }}
                          >
                            <FlaskConical className="size-3.5" />
                            {m['admin.settings.test.button']()}
                          </Button>
                        )}
                        <ChevronDown
                          className={`text-muted-foreground size-5 transition-transform ${
                            collapsed.has(group.name) ? '-rotate-90' : ''
                          }`}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  {!collapsed.has(group.name) && (
                    <CardContent className="space-y-4">
                      {groupSettings.map((setting) => (
                        <SettingField
                          key={setting.name}
                          setting={setting}
                          label={tDynamic(
                            `admin.settings.fields.${setting.name}`
                          )}
                          placeholder={
                            placeholders[setting.name] ?? setting.placeholder
                          }
                          tip={fieldTip(setting.name)}
                          extra={fieldExtra(setting.name, configs)}
                          value={
                            configs[setting.name] ?? setting.defaultValue ?? ''
                          }
                          onChange={(v) => handleChange(setting.name, v)}
                        />
                      ))}

                      {group.name === 'dataany' &&
                        (configs.dataany_connect_method ||
                          tabSettings.find(
                            (x) => x.name === 'dataany_connect_method'
                          )?.defaultValue ||
                          'oauth') === 'oauth' && (
                          <DataAnyConnect
                            websiteId={configs.dataany_website_id || ''}
                            onDisconnect={() => {
                              setConfigs((prev) => ({
                                ...prev,
                                dataany_website_id: '',
                              }));
                              disconnectMutation.mutate();
                            }}
                            disconnecting={disconnectMutation.isPending}
                          />
                        )}
                    </CardContent>
                  )}
                </Card>
              );
            })
          )}
        </div>
      </div>

      {testingGroup && getTestSpec(testingGroup) && (
        <SettingsTestDialog
          open={!!testingGroup}
          onOpenChange={(open) => !open && setTestingGroup(null)}
          group={testingGroup}
          spec={getTestSpec(testingGroup)!}
          groupTitle={tDynamic(`admin.settings.groups.${testingGroup}.title`)}
          configOverrides={Object.fromEntries(
            settings
              .filter(
                (s) => s.group === testingGroup && configs[s.name] !== undefined
              )
              .map((s) => [s.name, configs[s.name]])
          )}
        />
      )}
    </div>
  );
}

function DataAnyConnect({
  websiteId,
  onDisconnect,
  disconnecting,
}: {
  websiteId: string;
  onDisconnect: () => void;
  disconnecting: boolean;
}) {
  let domain = '';
  try {
    domain = new URL(
      (typeof window !== 'undefined' && window.location.origin) ||
        envConfigs.app_url
    ).hostname.replace(/^www\./, '');
  } catch {}
  const connectHref = `/api/admin/dataany/connect?locale=${encodeURIComponent(getLocale())}`;
  return (
    <div className="border-border bg-muted/35 rounded-xl border p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
          {websiteId ? (
            <CircleCheck className="size-4" />
          ) : (
            <Link2 className="size-4" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          {websiteId ? (
            <>
              <p className="text-sm font-semibold">
                {m['admin.settings.dataany.connected']()}
              </p>
              <code className="text-muted-foreground font-mono text-xs break-all">
                {websiteId}
              </code>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              {m['admin.settings.dataany.not_connected']({ domain })}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {websiteId && (
            <Button
              variant="outline"
              size="sm"
              disabled={disconnecting}
              onClick={onDisconnect}
            >
              {m['admin.settings.dataany.disconnect']()}
            </Button>
          )}
          <Button
            variant={websiteId ? 'outline' : 'default'}
            size="sm"
            onClick={() => window.location.assign(connectHref)}
          >
            {websiteId
              ? m['admin.settings.dataany.reconnect']()
              : m['admin.settings.dataany.connect']()}
          </Button>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/admin/settings')({
  validateSearch: z.object({
    tab: z.string().optional(),
    dataany: z.string().optional(),
  }),
  component: AdminSettingsPage,
});
