import { createFileRoute } from '@tanstack/react-router';
import { runAdminRoute } from '@/server/admin/execute';

export const Route = createFileRoute('/api/admin/directory/collections')({
  server: {
    handlers: {
      GET: (context) => runAdminRoute('directory_collections_list', context),
      POST: (context) => runAdminRoute('directory_collections_create', context),
      PUT: (context) => runAdminRoute('directory_collections_update', context),
      DELETE: (context) =>
        runAdminRoute('directory_collections_delete', context),
    },
  },
});
