import { createFileRoute } from '@tanstack/react-router';
import { runAdminRoute } from '@/server/admin/execute';

export const Route = createFileRoute('/api/admin/affiliates')({
  server: {
    handlers: {
      GET: (context) => runAdminRoute('affiliates_list', context),
      PUT: (context) => runAdminRoute('affiliates_update', context),
    },
  },
});
