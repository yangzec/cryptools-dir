import { useEffect, useState } from 'react';
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { MessageSquare, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { tDynamic } from '@/core/i18n/dynamic';
import { apiGet, apiPatch, apiPost, type PageResult } from '@/lib/api-client';
import { m } from '@/paraglide/messages.js';
import { DataTable, type Column } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { TicketsDialogs } from './-tickets-dialogs';
import {
  PAGE_SIZE,
  STATUS_BADGE,
  type TicketMessageRow,
  type TicketRow,
  type TicketStatus,
} from './-tickets-shared';

export function TicketsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<TicketStatus | 'all'>('all');

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploaderKey, setUploaderKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Detail dialog
  const [activeTicket, setActiveTicket] = useState<TicketRow | null>(null);
  const [messages, setMessages] = useState<TicketMessageRow[]>([]);
  const [reply, setReply] = useState('');
  const [replyAttachments, setReplyAttachments] = useState<string[]>([]);
  const [replyUploading, setReplyUploading] = useState(false);
  const [replyUploaderKey, setReplyUploaderKey] = useState(0);
  const [replying, setReplying] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status]);

  const listQuery = useQuery({
    queryKey: ['user-tickets', page, debouncedSearch, status],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (debouncedSearch) params.set('keyword', debouncedSearch);
      if (status !== 'all') params.set('status', status);
      return apiGet<PageResult<TicketRow>>(`/api/tickets?${params}`);
    },
    placeholderData: keepPreviousData,
  });
  const rows = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const refreshList = () =>
    queryClient.invalidateQueries({ queryKey: ['user-tickets'] });

  async function openDetail(row: TicketRow) {
    try {
      const data = await apiGet<{
        ticket: TicketRow;
        messages: TicketMessageRow[];
      }>(`/api/tickets/${row.id}`);
      setActiveTicket(data.ticket);
      setMessages(data.messages);
      setReplyAttachments([]);
      setReplyUploaderKey((k) => k + 1);
    } catch (e: any) {
      toast.error(e?.message || m['common.failed']());
    }
  }

  async function submitCreate() {
    if (!title.trim() || !content.trim()) {
      toast.error(m['settings.tickets.required']());
      return;
    }
    setSubmitting(true);
    try {
      await apiPost('/api/tickets', { title, content, attachments });
      toast.success(m['settings.tickets.create_success']());
      setCreateOpen(false);
      setTitle('');
      setContent('');
      setAttachments([]);
      setUploaderKey((k) => k + 1);
      setPage(1);
      refreshList();
    } catch (e: any) {
      toast.error(e?.message || m['common.failed']());
    } finally {
      setSubmitting(false);
    }
  }

  async function submitReply() {
    if (!activeTicket || !reply.trim()) return;
    setReplying(true);
    try {
      await apiPost(`/api/tickets/${activeTicket.id}`, {
        content: reply,
        attachments: replyAttachments,
      });
      setReply('');
      await openDetail(activeTicket);
      refreshList();
    } catch (e: any) {
      toast.error(e?.message || m['common.failed']());
    } finally {
      setReplying(false);
    }
  }

  async function closeTicket() {
    if (!activeTicket) return;
    try {
      await apiPatch(`/api/tickets/${activeTicket.id}`, { status: 'closed' });
      toast.success(m['settings.tickets.close_success']());
      setActiveTicket(null);
      refreshList();
    } catch (e: any) {
      toast.error(e?.message || m['common.failed']());
    }
  }

  const columns: Column<TicketRow>[] = [
    {
      header: m['settings.tickets.created_col'](),
      className: 'w-[160px]',
      cell: (r) => (
        <span className="text-muted-foreground">
          {new Date(r.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      header: m['settings.tickets.title_col'](),
      cell: (r) => (
        <button
          className="text-left font-medium hover:underline"
          onClick={() => openDetail(r)}
        >
          {r.title}
        </button>
      ),
    },
    {
      header: m['settings.tickets.latest_reply_col'](),
      cell: (r) => (
        <span className="text-muted-foreground block max-w-[280px] truncate">
          {r.latestReply || '—'}
        </span>
      ),
    },
    {
      header: m['settings.tickets.updated_col'](),
      className: 'w-[160px]',
      cell: (r) => (
        <span className="text-muted-foreground">
          {new Date(r.updatedAt).toLocaleString()}
        </span>
      ),
    },
    {
      header: m['settings.tickets.status_col'](),
      className: 'w-[120px]',
      cell: (r) => (
        <Badge variant={STATUS_BADGE[r.status]}>
          {tDynamic(`settings.tickets.status_${r.status}`)}
        </Badge>
      ),
    },
    {
      header: m['settings.tickets.actions_col'](),
      className: 'w-[80px]',
      cell: (r) => (
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => openDetail(r)}
        >
          <MessageSquare className="size-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {m['settings.tickets.title']()}
          </h1>
          <p className="text-muted-foreground">
            {m['settings.tickets.description']()}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="size-4" />
          {m['settings.tickets.create_button']()}
        </Button>
      </div>

      <Card>
        <CardContent>
          <DataTable
            columns={columns}
            data={rows}
            total={total}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            rowKey={(r) => r.id}
            emptyText={m['settings.tickets.empty']()}
            search={search}
            onSearchChange={setSearch}
            toolbar={
              <Select
                value={status}
                onValueChange={(value) =>
                  setStatus((value as TicketStatus) || 'all')
                }
              >
                <SelectTrigger className="h-9 w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {m['settings.tickets.status_all']()}
                  </SelectItem>
                  {(['open', 'replied', 'closed'] as const).map((st) => (
                    <SelectItem key={st} value={st}>
                      {tDynamic(`settings.tickets.status_${st}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
            onRefresh={() => listQuery.refetch()}
            loading={listQuery.isFetching || listQuery.isPending}
          />
        </CardContent>
      </Card>

      <TicketsDialogs
        createOpen={createOpen}
        setCreateOpen={setCreateOpen}
        title={title}
        setTitle={setTitle}
        content={content}
        setContent={setContent}
        setAttachments={setAttachments}
        uploading={uploading}
        setUploading={setUploading}
        uploaderKey={uploaderKey}
        submitting={submitting}
        submitCreate={submitCreate}
        activeTicket={activeTicket}
        setActiveTicket={setActiveTicket}
        messages={messages}
        reply={reply}
        setReply={setReply}
        setReplyAttachments={setReplyAttachments}
        replyUploading={replyUploading}
        setReplyUploading={setReplyUploading}
        replyUploaderKey={replyUploaderKey}
        replying={replying}
        submitReply={submitReply}
        closeTicket={closeTicket}
      />
    </div>
  );
}
