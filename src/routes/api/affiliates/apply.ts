import { createFileRoute } from '@tanstack/react-router';
import { affiliateRouteUser } from '@/server/affiliates';

import { applyAffiliate } from '@/modules/affiliates/service';
import { getAllConfigs } from '@/modules/config/service';
import { respData, respErr } from '@/lib/resp';

// Apply to join the affiliate program. Reviewed at /admin/affiliates unless
// Settings → Users → Affiliates → auto approve is on.
async function POST({ request }: { request: Request }) {
  const gate = await affiliateRouteUser(request, { rateLimitMs: 3000 });
  if ('response' in gate) return gate.response;

  try {
    const body = await request.json().catch(() => ({}));
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
    if (!reason) return respErr('reason_required');

    const configs = await getAllConfigs();
    const result = await applyAffiliate({
      userId: gate.user.id,
      userEmail: gate.user.email,
      reason,
      autoApprove: configs.affiliate_auto_approve === 'true',
    });
    return respData(result);
  } catch (error: any) {
    console.error('affiliate apply failed', error);
    return respErr('Internal error');
  }
}

export const Route = createFileRoute('/api/affiliates/apply')({
  server: { handlers: { POST } },
});
