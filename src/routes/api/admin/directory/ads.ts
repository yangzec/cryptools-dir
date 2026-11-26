import { createFileRoute } from '@tanstack/react-router';
import { runAdminRoute } from '@/server/admin/execute';

export const Route = createFileRoute('/api/admin/directory/ads')({
  server: {
    handlers: {
      GET: (context) => runAdminRoute('directory_ads_list', context),
      PUT: (context) => runAdminRoute('directory_ads_update', context),
      DELETE: (context) => runAdminRoute('directory_ads_delete', context),
    },
  },
});
