import { createFileRoute } from '@tanstack/react-router';
import { runAdminRoute } from '@/server/admin/execute';

export const Route = createFileRoute('/api/admin/affiliates/invites')({
  server: {
    handlers: {
      GET: (context) => runAdminRoute('affiliates_invites_list', context),
    },
  },
});
