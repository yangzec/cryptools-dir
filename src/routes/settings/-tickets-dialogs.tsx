import { tDynamic } from '@/core/i18n/dynamic';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { ImageUploader } from '@/components/image-uploader';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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
import { Textarea } from '@/components/ui/textarea';

import {
  AttachmentGrid,
  STATUS_BADGE,
  uploaderState,
  type TicketMessageRow,
  type TicketRow,
} from './-tickets-shared';

export function TicketsDialogs(props: {
  createOpen: boolean;
  setCreateOpen: (v: boolean) => void;
  title: string;
  setTitle: (v: string) => void;
  content: string;
  setContent: (v: string) => void;
  setAttachments: (v: string[]) => void;
  uploading: boolean;
  setUploading: (v: boolean) => void;
  uploaderKey: number;
  submitting: boolean;
  submitCreate: () => void;
  activeTicket: TicketRow | null;
  setActiveTicket: (v: TicketRow | null) => void;
  messages: TicketMessageRow[];
  reply: string;
  setReply: (v: string) => void;
  setReplyAttachments: (v: string[]) => void;
  replyUploading: boolean;
  setReplyUploading: (v: boolean) => void;
  replyUploaderKey: number;
  replying: boolean;
  submitReply: () => void;
  closeTicket: () => void;
}) {
  const {
    createOpen,
    setCreateOpen,
    title,
    setTitle,
    content,
    setContent,
    setAttachments,
    uploading,
    setUploading,
    uploaderKey,
    submitting,
    submitCreate,
    activeTicket,
    setActiveTicket,
    messages,
    reply,
    setReply,
    setReplyAttachments,
    replyUploading,
    setReplyUploading,
    replyUploaderKey,
    replying,
    submitReply,
    closeTicket,
  } = props;
  return (
    <>
      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m['settings.tickets.create_title']()}</DialogTitle>
            <DialogDescription>
              {m['settings.tickets.create_description']()}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitCreate();
            }}
          >
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="ticket-title">
                  {m['settings.tickets.title_label']()}
                </Label>
                <Input
                  id="ticket-title"
                  value={title}
                  maxLength={200}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={m['settings.tickets.title_placeholder']()}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ticket-content">
                  {m['settings.tickets.content_label']()}
                </Label>
                <Textarea
                  id="ticket-content"
                  value={content}
                  maxLength={5000}
                  rows={6}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={m['settings.tickets.content_placeholder']()}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{m['settings.tickets.attachments_label']()}</Label>
                <ImageUploader
                  key={uploaderKey}
                  allowMultiple
                  maxImages={9}
                  onChange={(items) => {
                    const { urls, uploading: busy } = uploaderState(items);
                    setAttachments(urls);
                    setUploading(busy);
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                {m['settings.tickets.cancel']()}
              </Button>
              <Button type="submit" disabled={submitting || uploading}>
                {submitting
                  ? m['settings.tickets.creating']()
                  : m['settings.tickets.create_submit']()}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog
        open={!!activeTicket}
        onOpenChange={(v) => !v && setActiveTicket(null)}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {activeTicket?.title}
              {activeTicket && (
                <Badge variant={STATUS_BADGE[activeTicket.status]}>
                  {tDynamic(`settings.tickets.status_${activeTicket.status}`)}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[50vh] space-y-3 overflow-y-auto py-2">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'rounded-lg p-3 text-sm',
                  msg.role === 'admin' ? 'bg-primary/10 mr-8' : 'bg-muted ml-8'
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-medium">
                    {msg.role === 'user' && (
                      <Avatar className="size-5">
                        <AvatarImage src={msg.userAvatar || undefined} />
                        <AvatarFallback className="text-[10px]">
                          {(msg.userName || 'U').charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    {msg.role === 'admin'
                      ? m['settings.tickets.support_team']()
                      : msg.userName || m['settings.tickets.you']()}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {new Date(msg.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="whitespace-pre-wrap">{msg.content}</p>
                <AttachmentGrid urls={msg.attachments} />
              </div>
            ))}
          </div>

          {activeTicket?.status !== 'closed' ? (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                submitReply();
              }}
            >
              <Textarea
                value={reply}
                maxLength={5000}
                rows={3}
                onChange={(e) => setReply(e.target.value)}
                placeholder={m['settings.tickets.reply_placeholder']()}
              />
              <ImageUploader
                key={replyUploaderKey}
                allowMultiple
                maxImages={9}
                onChange={(items) => {
                  const { urls, uploading: busy } = uploaderState(items);
                  setReplyAttachments(urls);
                  setReplyUploading(busy);
                }}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeTicket}>
                  {m['settings.tickets.close_ticket']()}
                </Button>
                <Button
                  type="submit"
                  disabled={replying || replyUploading || !reply.trim()}
                >
                  {replying
                    ? m['settings.tickets.replying']()
                    : m['settings.tickets.reply_submit']()}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <p className="text-muted-foreground text-sm">
              {m['settings.tickets.closed_notice']()}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
