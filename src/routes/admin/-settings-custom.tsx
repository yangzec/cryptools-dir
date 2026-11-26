import { Minus, Plus } from 'lucide-react';

import { m } from '@/paraglide/messages.js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export function SettingsCustomCard({
  customRows,
  onAdd,
  onRemove,
  onUpdate,
}: {
  customRows: { key: string; value: string }[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, field: 'key' | 'value', value: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{m['admin.settings.custom.title']()}</CardTitle>
        <p className="text-muted-foreground text-sm">
          {m['admin.settings.custom.description']()}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {customRows.length === 0 && (
          <p className="text-muted-foreground text-sm">
            {m['admin.settings.custom.empty']()}
          </p>
        )}
        {customRows.map((row, i) => (
          <div key={i} className="flex items-start gap-2">
            <Input
              value={row.key}
              onChange={(e) => onUpdate(i, 'key', e.target.value)}
              placeholder={m['admin.settings.custom.key_placeholder']()}
              className="w-1/3 shrink-0 font-mono"
            />
            <textarea
              value={row.value}
              onChange={(e) => onUpdate(i, 'value', e.target.value)}
              placeholder={m['admin.settings.custom.value_placeholder']()}
              rows={1}
              className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex h-8 max-h-48 min-h-8 flex-1 resize-y rounded-lg border bg-transparent px-2.5 py-1 text-base leading-6 transition-colors outline-none focus-visible:ring-3 md:text-sm"
            />
            <Button
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={() => onRemove(i)}
              aria-label={m['admin.settings.custom.remove']()}
            >
              <Minus className="size-4" />
            </Button>
          </div>
        ))}
        <Button variant="outline" onClick={onAdd} className="gap-1.5">
          <Plus className="size-4" />
          {m['admin.settings.custom.add']()}
        </Button>
      </CardContent>
    </Card>
  );
}
