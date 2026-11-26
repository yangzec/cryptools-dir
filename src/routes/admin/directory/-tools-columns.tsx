import { Ban, Check, Pencil, ThumbsDown, Trash2 } from 'lucide-react';

import { tDynamic } from '@/core/i18n/dynamic';
import { faviconUrlForWebsite } from '@/lib/directory/favicon-url';
import { formatDateTime } from '@/lib/time';
import { m } from '@/paraglide/messages.js';
import { type Column } from '@/components/data-table';
import { DirectoryListIcon } from '@/components/directory/DirectoryListIcon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import {
  canDeleteTool,
  canForceUnpublishTool,
  type DirTool,
} from './-tools-shared';

export function buildToolColumns(opts: {
  onApprove: (id: string) => void;
  onReject: (row: DirTool) => void;
  onForceUnpublish: (row: DirTool) => void;
  onEdit: (id: string) => void;
  onDelete: (row: DirTool) => void;
}): Column<DirTool>[] {
  const { onApprove, onReject, onForceUnpublish, onEdit, onDelete } = opts;
  return [
    {
      header: m['admin.directory.tools.col_name'](),
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-2">
          <DirectoryListIcon
            src={r.iconUrl || faviconUrlForWebsite(r.websiteUrl)}
            alt={r.name}
            size={28}
          />
          <div className="min-w-0">
            <p className="truncate font-medium">{r.name}</p>
            <p className="text-muted-foreground truncate text-xs">{r.slug}</p>
          </div>
        </div>
      ),
    },
    {
      header: m['admin.directory.tools.col_category'](),
      cell: (r) => (
        <span className="text-sm">
          {r.categoryName || m['admin.directory.tools.no_category']()}
        </span>
      ),
      className: 'hidden md:table-cell',
    },
    {
      header: m['admin.directory.tools.col_source'](),
      cell: (r) => (
        <Badge variant="secondary">
          {tDynamic(`admin.directory.source_${r.source}`)}
        </Badge>
      ),
      className: 'hidden sm:table-cell',
    },
    {
      header: m['admin.directory.common.status'](),
      cell: (r) => (
        <Badge
          variant={
            r.status === 'published'
              ? 'default'
              : r.status === 'pending'
                ? 'outline'
                : 'secondary'
          }
        >
          {tDynamic(`admin.directory.status_${r.status}`)}
        </Badge>
      ),
    },
    {
      header: m['admin.directory.tools.col_featured'](),
      cell: (r) => (r.featured ? '✓' : '—'),
      className: 'hidden lg:table-cell w-[70px]',
    },
    {
      header: m['admin.directory.tools.sort'](),
      cell: (r) => <span className="text-sm tabular-nums">{r.sort}</span>,
      className: 'hidden lg:table-cell w-[70px]',
    },
    {
      header: m['admin.directory.common.created_at'](),
      cell: (r) => (
        <span className="text-muted-foreground text-sm">
          {formatDateTime(r.createdAt)}
        </span>
      ),
      className: 'hidden xl:table-cell',
    },
    {
      header: m['admin.directory.common.actions'](),
      className: 'w-[140px]',
      cell: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.status === 'pending' ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                title={m['admin.directory.tools.approve']()}
                onClick={() => onApprove(r.id)}
              >
                <Check className="size-3.5 text-green-600" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                title={m['admin.directory.tools.reject']()}
                onClick={() => onReject(r)}
              >
                <ThumbsDown className="text-destructive size-3.5" />
              </Button>
            </>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => onEdit(r.id)}
          >
            <Pencil className="size-3" />
          </Button>
          {canForceUnpublishTool(r.status) ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              title={m['admin.directory.tools.force_unpublish']()}
              onClick={() => onForceUnpublish(r)}
            >
              <Ban className="size-3" />
            </Button>
          ) : null}
          {canDeleteTool(r.status) ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => onDelete(r)}
            >
              <Trash2 className="size-3" />
            </Button>
          ) : null}
        </div>
      ),
    },
  ];
}
