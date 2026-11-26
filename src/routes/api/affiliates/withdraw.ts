import { createFileRoute } from '@tanstack/react-router';
import { affiliateRouteUser } from '@/server/affiliates';

import { createWithdraw } from '@/modules/affiliates/service';
import { respData, respErr } from '@/lib/resp';

// Request a payout of every balance above its minimum. `description` is
// where to send it (e.g. a PayPal email); an admin pays by hand.
async function POST({ request }: { request: Request }) {
  const gate = await affiliateRouteUser(request, { rateLimitMs: 3000 });
  if ('response' in gate) return gate.response;

  try {
    const body = await request.json().catch(() => ({}));
    const description =
      typeof body?.description === 'string' ? body.description.trim() : '';
    if (!description) return respErr('description_required');

    const result = await createWithdraw({
      userId: gate.user.id,
      description,
    });
    if (!result.ok) return respErr(result.error || 'withdraw_failed');
    return respData({ ok: true });
  } catch (error: any) {
    console.error('affiliate withdraw failed', error);
    return respErr('Internal error');
  }
}

export const Route = createFileRoute('/api/affiliates/withdraw')({
  server: { handlers: { POST } },
});
