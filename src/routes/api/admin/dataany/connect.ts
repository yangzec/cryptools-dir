import { createFileRoute } from '@tanstack/react-router';
import { startDataanyConnect } from '@/server/dataany/connect';

export const Route = createFileRoute('/api/admin/dataany/connect')({
  server: {
    handlers: { GET: ({ request }) => startDataanyConnect(request) },
  },
});
