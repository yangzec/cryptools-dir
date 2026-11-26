import { useState, type ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

import { tDynamic } from '@/core/i18n/dynamic';
import {
  APPEARANCE_ENABLED_KEY,
  COLOR_MODE_CONFIG_KEY,
  type AppearanceKey,
} from '@/config/appearance';
import { listProductMappingCatalog } from '@/config/pricing';
import { type Setting } from '@/modules/config/settings';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { appearanceOptions, colorModeOptions } from '@/hooks/use-appearance';
import { AppearanceOptions } from '@/components/appearance-options';
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
import { Switch } from '@/components/ui/switch';

export function productIdsMappingPlaceholder(samplePrefix: string): string {
  return JSON.stringify(
    Object.fromEntries(
      listProductMappingCatalog().map((product) => [
        product.productId,
        `${samplePrefix}${product.productId}`,
      ])
    ),
    null,
    2
  );
}

// Saved secrets come back masked with this prefix (see modules/config/service).
const MASKED_PREFIX = '••••••••';

/**
 * Telegram's getUpdates link for the token in the form, so the admin can read
 * chat.id after messaging the bot. Built only from an unsaved, well-formed
 * token — a saved token is masked and never sent back to the browser.
 */
function TelegramChatIdHelper({
  configs,
}: {
  configs: Record<string, string>;
}) {
  const token = (configs.telegram_bot_token || '').trim();
  if (!token) return null;
  if (token.startsWith(MASKED_PREFIX)) {
    return (
      <p className="text-muted-foreground text-xs">
        {m['admin.settings.telegram_token_masked']()}
      </p>
    );
  }
  if (!/^\d+:[\w-]+$/.test(token)) return null;
  const base =
    (configs.telegram_api_base || '').trim() || 'https://api.telegram.org';
  const url = `${base.replace(/\/+$/, '')}/bot${token}/getUpdates`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="text-primary inline-flex items-center gap-1 text-xs font-medium underline-offset-4 hover:underline"
    >
      {m['admin.settings.telegram_get_chat_id']()}
      <ExternalLink className="size-3" />
    </a>
  );
}

export function fieldExtra(
  name: string,
  configs: Record<string, string>
): ReactNode {
  if (name === 'telegram_chat_id') {
    return <TelegramChatIdHelper configs={configs} />;
  }
  return null;
}

// Optional per-field help text: `admin.settings.tips.<name>` if defined.
export function fieldTip(name: string): string | undefined {
  const key = `admin.settings.tips.${name}`;
  const text = tDynamic(key);
  return text === key ? undefined : text;
}

// Appearance settings render as chip pickers instead of a plain select.
export const ADMIN_APPEARANCE_FIELDS: Record<string, AppearanceKey> = {
  app_theme: 'theme',
  app_font: 'font',
  app_font_size: 'fontSize',
  app_sidebar_variant: 'sidebarVariant',
  app_sidebar_collapsible: 'sidebarCollapsible',
};

// Saved as soon as they change, without the Save button.
export const INSTANT_SETTINGS = new Set([
  APPEARANCE_ENABLED_KEY,
  ...Object.keys(ADMIN_APPEARANCE_FIELDS),
  COLOR_MODE_CONFIG_KEY,
  'user_theme_enabled',
]);

export function SettingField({
  setting,
  label,
  placeholder,
  tip,
  extra,
  value,
  onChange,
}: {
  setting: Setting;
  label: string;
  placeholder?: string;
  tip?: string;
  /** Rendered between the input and the tip (field-specific helpers). */
  extra?: ReactNode;
  value: string;
  onChange: (value: string) => void;
}) {
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const tipNode = tip ? (
    <p className="text-muted-foreground text-xs leading-relaxed break-words whitespace-pre-line">
      {tip}
    </p>
  ) : null;

  const appearanceKey = ADMIN_APPEARANCE_FIELDS[setting.name];
  if (appearanceKey || setting.name === COLOR_MODE_CONFIG_KEY) {
    return (
      <div className="space-y-2">
        <Label className="select-text">{label}</Label>
        <AppearanceOptions
          options={
            appearanceKey
              ? appearanceOptions(appearanceKey)
              : colorModeOptions()
          }
          value={value}
          onChange={onChange}
        />
        {tipNode}
      </div>
    );
  }

  if (setting.type === 'switch') {
    return (
      <div className="space-y-2">
        <Label htmlFor={setting.name} className="select-text">
          {label}
        </Label>
        <div>
          <Switch
            id={setting.name}
            checked={value === 'true'}
            onCheckedChange={(checked) => onChange(checked ? 'true' : 'false')}
          />
        </div>
        {tipNode}
      </div>
    );
  }

  if (setting.type === 'select' && setting.options) {
    return (
      <div className="space-y-2">
        <Label htmlFor={setting.name} className="select-text">
          {label}
        </Label>
        <Select value={value} onValueChange={(v) => onChange(v || '')}>
          <SelectTrigger>
            <SelectValue placeholder={placeholder || 'Select...'} />
          </SelectTrigger>
          <SelectContent>
            {setting.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {tipNode}
      </div>
    );
  }

  if (setting.type === 'textarea') {
    const isProductMapping =
      setting.name === 'creem_product_ids_mapping' ||
      setting.name === 'waffo_product_ids_mapping' ||
      setting.name === 'dodo_product_ids_mapping';
    const hasFillTemplate = isProductMapping;
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={setting.name} className="select-text">
            {label}
          </Label>
          {hasFillTemplate && (
            <button
              type="button"
              onClick={() => setConfirmDialogOpen(true)}
              className="text-primary cursor-pointer text-xs font-medium transition-colors hover:underline"
            >
              {m['admin.settings.product_mapping.fill_template']()}
            </button>
          )}
        </div>
        <textarea
          id={setting.name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={isProductMapping ? 10 : 3}
          className={cn(
            'border-input placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border bg-transparent px-3 py-2 text-sm focus-visible:ring-1 focus-visible:outline-none',
            hasFillTemplate && 'font-mono'
          )}
        />
        {hasFillTemplate && (
          <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {m['admin.settings.product_mapping.dialog_title']()}
                </DialogTitle>
                <DialogDescription>
                  {m['admin.settings.product_mapping.dialog_desc']()}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConfirmDialogOpen(false)}
                >
                  {m['admin.settings.product_mapping.dialog_cancel']()}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    onChange(placeholder || '');
                    setConfirmDialogOpen(false);
                    toast.success(
                      m['admin.settings.product_mapping.filled_success']()
                    );
                  }}
                >
                  {m['admin.settings.product_mapping.dialog_confirm']()}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
        {tipNode}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={setting.name} className="select-text">
        {label}
      </Label>
      <Input
        id={setting.name}
        type={
          setting.type === 'password'
            ? 'password'
            : setting.type === 'number'
              ? 'number'
              : 'text'
        }
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {extra}
      {tipNode}
    </div>
  );
}
