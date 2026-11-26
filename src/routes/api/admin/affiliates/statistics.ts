import { createFileRoute } from '@tanstack/react-router';
import { runAdminRoute } from '@/server/admin/execute';

export const Route = createFileRoute('/api/admin/affiliates/statistics')({
  server: {
    handlers: {
      GET: (context) => runAdminRoute('affiliates_statistics', context),
    },
  },
});
