import { createFileRoute } from '@tanstack/react-router';
import { runAdminRoute } from '@/server/admin/execute';

export const Route = createFileRoute('/api/admin/affiliates/withdraws')({
  server: {
    handlers: {
      GET: (context) => runAdminRoute('affiliates_withdraws_list', context),
      PUT: (context) => runAdminRoute('affiliates_withdraws_update', context),
    },
  },
});
