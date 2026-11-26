import type { ImageUploaderValue } from '@/components/image-uploader';

export type TicketStatus = 'open' | 'replied' | 'closed';

export interface TicketRow {
  id: string;
  title: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  latestReply: string | null;
}

export interface TicketMessageRow {
  id: string;
  role: 'user' | 'admin';
  content: string;
  attachments: string[];
  createdAt: string;
  userName: string | null;
  userAvatar: string | null;
}

/** Extract uploaded URLs from uploader items; true while any upload is in flight. */
export function uploaderState(items: ImageUploaderValue[]) {
  return {
    urls: items
      .filter((i) => i.status === 'uploaded' && i.url)
      .map((i) => i.url!),
    uploading: items.some((i) => i.status === 'uploading'),
  };
}

export function AttachmentGrid({ urls }: { urls: string[] }) {
  if (!urls.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {urls.map((url, i) => (
        <a
          key={`${url}-${i}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            src={url}
            alt=""
            className="border-border size-16 rounded-md border object-cover transition-opacity hover:opacity-80"
          />
        </a>
      ))}
    </div>
  );
}

export const PAGE_SIZE = 20;

export const STATUS_BADGE: Record<
  TicketStatus,
  'default' | 'secondary' | 'outline'
> = {
  open: 'default',
  replied: 'secondary',
  closed: 'outline',
};
