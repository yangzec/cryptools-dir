import { createFileRoute } from '@tanstack/react-router';
import { userFeatureEnabled } from '@/server/user-features';

import { getInviteLeaderboard } from '@/modules/affiliates/service';
import { enforceMinIntervalRateLimit } from '@/lib/rate-limit';
import { respData, respErr } from '@/lib/resp';

// Public top inviters (names masked) for the /affiliates page.
async function GET({ request }: { request: Request }) {
  const limited = enforceMinIntervalRateLimit(request, {
    intervalMs: 500,
    keyPrefix: 'affiliates-leaderboard',
  });
  if (limited) return limited;
  try {
    if (!(await userFeatureEnabled('affiliates_enabled')))
      return respData({ items: [] });
    return respData({ items: await getInviteLeaderboard(10) });
  } catch {
    return respErr('Failed to load leaderboard');
  }
}

export const Route = createFileRoute('/api/affiliates/leaderboard')({
  server: { handlers: { GET } },
});
