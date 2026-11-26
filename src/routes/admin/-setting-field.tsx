import type { ReactNode } from 'react';

import { tDynamic } from '@/core/i18n/dynamic';
import { COLOR_MODE_CONFIG_KEY, type AppearanceKey } from '@/config/appearance';
import type { Setting } from '@/modules/config/settings';
import { appearanceOptions, colorModeOptions } from '@/hooks/use-appearance';
import { AppearanceOptions } from '@/components/appearance-options';
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

/** One admin setting's input, shared by /admin/settings and module pages. */
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
  const tipNode = tip ? (
    <p className="text-muted-foreground text-xs leading-relaxed break-words whitespace-pre-line">
      {tip}
    </p>
  ) : null;

  const appearanceKey = ADMIN_APPEARANCE_FIELDS[setting.name];
  if (appearanceKey || setting.name === COLOR_MODE_CONFIG_KEY) {
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
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
        <Label htmlFor={setting.name}>{label}</Label>
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
        <Label htmlFor={setting.name}>{label}</Label>
        <Select value={value} onValueChange={(v) => onChange(v || '')}>
          <SelectTrigger>
            <SelectValue placeholder={placeholder || 'Select...'} />
          </SelectTrigger>
          <SelectContent>
            {setting.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {optionLabel(setting.name, opt)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {tipNode}
      </div>
    );
  }

  if (setting.type === 'textarea') {
    return (
      <div className="space-y-2">
        <Label htmlFor={setting.name}>{label}</Label>
        <textarea
          id={setting.name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="border-input placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border bg-transparent px-3 py-2 text-sm focus-visible:ring-1 focus-visible:outline-none"
        />
        {tipNode}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={setting.name}>{label}</Label>
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

/** A select option's label: `admin.settings.options.<field>.<value>` if set. */
export function optionLabel(
  field: string,
  opt: { label: string; value: string }
) {
  const key = `admin.settings.options.${field}.${opt.value}`;
  const text = tDynamic(key);
  return text === key ? opt.label : text;
}
