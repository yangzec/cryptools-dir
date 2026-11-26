import { createFileRoute } from '@tanstack/react-router';
import { finishDataanyConnect } from '@/server/dataany/connect';

export const Route = createFileRoute('/api/admin/dataany/callback')({
  server: {
    handlers: { GET: ({ request }) => finishDataanyConnect(request) },
  },
});
