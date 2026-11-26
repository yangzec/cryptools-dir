import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { toast } from 'sonner';

import { apiPut } from '@/lib/api-client';
import { m } from '@/paraglide/messages.js';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';

import type { DirCollection, ToolOption } from './-collections-form';
import { DirectoryFormBody, DirectoryFormDrawer } from './-form-ui';

export function CollectionToolsDialog({
  collection,
  tools,
  toolsLoading = false,
  onClose,
  onSaved,
}: {
  collection: DirCollection | null;
  tools: ToolOption[];
  toolsLoading?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [toolIds, setToolIds] = useState<string[]>([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (!collection) return;
    setToolIds([...(collection.toolIds || [])]);
    setFilter('');
  }, [collection]);

  const toolMap = useMemo(() => {
    const map = new Map<string, ToolOption>();
    for (const t of tools) map.set(t.id, t);
    return map;
  }, [tools]);

  const selected = useMemo(
    () =>
      toolIds
        .map((id) => toolMap.get(id))
        .filter((t): t is ToolOption => Boolean(t)),
    [toolIds, toolMap]
  );

  const q = filter.trim().toLowerCase();
  const available = useMemo(() => {
    const selectedSet = new Set(toolIds);
    return tools.filter((t) => {
      if (selectedSet.has(t.id)) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q)
      );
    });
  }, [tools, toolIds, q]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiPut('/api/admin/directory/collections', {
        id: collection!.id,
        toolIds,
      }),
    onSuccess: () => {
      toast.success(m['admin.directory.collections.tools_saved']());
      onSaved();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function move(id: string, delta: -1 | 1) {
    setToolIds((prev) => {
      const i = prev.indexOf(id);
      if (i < 0) return prev;
      const j = i + delta;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      const tmp = next[i]!;
      next[i] = next[j]!;
      next[j] = tmp;
      return next;
    });
  }

  return (
    <DirectoryFormDrawer
      open={!!collection}
      onOpenChange={(v) => !v && onClose()}
      title={m['admin.directory.collections.manage_tools_title']()}
      description={
        collection
          ? m['admin.directory.collections.manage_tools_description']({
              name: collection.nameZh || collection.name,
            })
          : undefined
      }
    >
      <DirectoryFormBody
        actions={
          <>
            <Button type="button" variant="outline" onClick={onClose}>
              {m['admin.directory.common.cancel']()}
            </Button>
            <Button
              type="button"
              disabled={saveMutation.isPending || !collection}
              onClick={() => saveMutation.mutate()}
            >
              {m['admin.directory.common.save']()}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">
              {m['admin.directory.collections.selected_tools']()}
              <span className="text-muted-foreground ml-1 tabular-nums">
                ({selected.length})
              </span>
            </p>
            {selected.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {m['admin.directory.collections.tools_hint']()}
              </p>
            ) : (
              <ul className="space-y-1">
                {selected.map((tool, index) => (
                  <li
                    key={tool.id}
                    className="bg-muted/40 flex items-center gap-1 rounded-md px-2 py-1.5"
                  >
                    <span className="text-muted-foreground w-5 shrink-0 text-xs tabular-nums">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {tool.name}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      disabled={index === 0}
                      onClick={() => move(tool.id, -1)}
                      aria-label={m['admin.directory.collections.move_up']()}
                    >
                      <ChevronUp className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      disabled={index === selected.length - 1}
                      onClick={() => move(tool.id, 1)}
                      aria-label={m['admin.directory.collections.move_down']()}
                    >
                      <ChevronDown className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() =>
                        setToolIds((prev) =>
                          prev.filter((id) => id !== tool.id)
                        )
                      }
                      aria-label={m['admin.directory.common.delete']()}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">
              {m['admin.directory.collections.available_tools']()}
            </p>
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={m['admin.directory.collections.tools_search']()}
            />
            {toolsLoading ? (
              <p className="text-muted-foreground text-sm">
                {m['admin.loading']()}
              </p>
            ) : tools.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {m['admin.directory.collections.no_tools']()}
              </p>
            ) : available.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {m['admin.directory.collections.no_match_tools']()}
              </p>
            ) : (
              <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
                {available.map((tool) => (
                  <label
                    key={tool.id}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={false}
                      onCheckedChange={(v) => {
                        if (v) setToolIds((prev) => [...prev, tool.id]);
                      }}
                    />
                    <span className="truncate">{tool.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </DirectoryFormBody>
    </DirectoryFormDrawer>
  );
}
