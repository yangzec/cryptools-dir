import { createFileRoute } from '@tanstack/react-router';
import { runAdminRoute } from '@/server/admin/execute';

export const Route = createFileRoute('/api/admin/directory/tags')({
  server: {
    handlers: {
      GET: (context) => runAdminRoute('directory_tags_list', context),
      POST: (context) => runAdminRoute('directory_tags_create', context),
      PUT: (context) => runAdminRoute('directory_tags_update', context),
      DELETE: (context) => runAdminRoute('directory_tags_delete', context),
    },
  },
});
