import { createFileRoute } from '@tanstack/react-router';
import { runAdminRoute } from '@/server/admin/execute';

export const Route = createFileRoute('/api/admin/affiliates/detail')({
  server: {
    handlers: {
      GET: (context) => runAdminRoute('affiliates_detail', context),
    },
  },
});
