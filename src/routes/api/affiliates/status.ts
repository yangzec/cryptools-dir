import { createFileRoute } from '@tanstack/react-router';
import { userFeatureEnabled } from '@/server/user-features';

import { getAuth } from '@/core/auth';
import {
  findAffiliateUserByUserId,
  getRewardRule,
  isAffiliateApproved,
} from '@/modules/affiliates/service';
import { respData } from '@/lib/resp';

// Public: whether the program is on, what affiliates earn (`rule`), and the
// viewer's membership, for the /affiliates page. Signed-out: status null.
async function GET({ request }: { request: Request }) {
  try {
    const enabled = await userFeatureEnabled('affiliates_enabled');
    if (!enabled)
      return respData({ enabled, isMember: false, status: null, rule: null });
    const rule = await getRewardRule();
    const session = await getAuth().api.getSession({
      headers: request.headers,
    });
    if (!session?.user)
      return respData({ enabled, isMember: false, status: null, rule });
    const affiliate = await findAffiliateUserByUserId(session.user.id);
    return respData({
      enabled,
      isMember: isAffiliateApproved(affiliate),
      status: affiliate?.status ?? null,
      rule,
    });
  } catch {
    return respData({
      enabled: false,
      isMember: false,
      status: null,
      rule: null,
    });
  }
}

export const Route = createFileRoute('/api/affiliates/status')({
  server: { handlers: { GET } },
});
