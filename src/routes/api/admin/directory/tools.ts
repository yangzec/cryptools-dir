import { createFileRoute } from '@tanstack/react-router';
import { runAdminRoute } from '@/server/admin/execute';

export const Route = createFileRoute('/api/admin/directory/tools')({
  server: {
    handlers: {
      GET: (context) => runAdminRoute('directory_tools_list', context),
      POST: (context) => runAdminRoute('directory_tools_create', context),
      PUT: (context) => runAdminRoute('directory_tools_update', context),
      DELETE: (context) => runAdminRoute('directory_tools_delete', context),
    },
  },
});
