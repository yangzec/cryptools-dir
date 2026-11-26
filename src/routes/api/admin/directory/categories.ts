import { createFileRoute } from '@tanstack/react-router';
import { runAdminRoute } from '@/server/admin/execute';

export const Route = createFileRoute('/api/admin/directory/categories')({
  server: {
    handlers: {
      GET: (context) => runAdminRoute('directory_categories_list', context),
      POST: (context) => runAdminRoute('directory_categories_create', context),
      PUT: (context) => runAdminRoute('directory_categories_update', context),
      DELETE: (context) =>
        runAdminRoute('directory_categories_delete', context),
    },
  },
});
