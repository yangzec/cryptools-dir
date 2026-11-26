import { createFileRoute } from '@tanstack/react-router';
import { runAdminRoute } from '@/server/admin/execute';

export const Route = createFileRoute('/api/admin/affiliates/rewards')({
  server: {
    handlers: {
      GET: (context) => runAdminRoute('affiliates_rewards_list', context),
      POST: (context) => runAdminRoute('affiliates_rewards_create', context),
    },
  },
});
