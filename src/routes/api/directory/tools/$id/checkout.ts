import { createFileRoute } from '@tanstack/react-router';
import { resolveCharge } from '@/server/payment/charge';

import { getAuth } from '@/core/auth';
import { getAllConfigs } from '@/modules/config/service';
import {
  directoryToolOrderReference,
  getPayableDirectoryTool,
} from '@/modules/directory/payment';
import { createCheckout } from '@/modules/payment/service';
import { localizedPath } from '@/lib/locale-path';
import { enforceMinIntervalRateLimit } from '@/lib/rate-limit';
import { respData, respErr } from '@/lib/resp';

async function POST({
  request,
  params,
}: {
  request: Request;
  params: { id: string };
}) {
  const limited = enforceMinIntervalRateLimit(request, {
    intervalMs: 1000,
    keyPrefix: 'directory-tool-checkout',
  });
  if (limited) return limited;

  try {
    const session = await getAuth().api.getSession({
      headers: request.headers,
    });
    if (!session?.user) return respErr('Unauthorized');

    const userLimited = enforceMinIntervalRateLimit(request, {
      intervalMs: 1000,
      keyPrefix: 'directory-tool-checkout',
      extraKey: session.user.id,
    });
    if (userLimited) return userLimited;

    const { tool, pkg, existingCheckoutUrl } = await getPayableDirectoryTool(
      params.id,
      session.user.id
    );
    if (existingCheckoutUrl) {
      return respData({ checkout_url: existingCheckoutUrl });
    }
    const body = await request.json().catch(() => ({}));
    const configs = await getAllConfigs();
    const charge = await resolveCharge({
      product: pkg,
      paymentProvider:
        typeof body.payment_provider === 'string'
          ? body.payment_provider
          : undefined,
      userId: session.user.id,
      configs,
    });
    if ('error' in charge) return respErr(charge.error);

    const baseUrl = configs.app_url || 'http://localhost:3000';
    const back = `${baseUrl}${localizedPath('/settings/submissions', body.locale)}`;
    const checkout = await createCheckout({
      reference: directoryToolOrderReference(tool.id),
      userId: session.user.id,
      userEmail: session.user.email,
      productName: pkg.productName,
      planName: pkg.planName,
      credits: 0,
      paymentOrder: {
        productId: pkg.productId,
        price: { amount: charge.amount, currency: charge.currency },
        type: pkg.type,
        description: `${pkg.description}: ${tool.slug}`,
        successUrl: `${baseUrl}/api/payment/callback?redirect=${encodeURIComponent(back)}`,
        cancelUrl: back,
        customer: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
        },
      },
      provider: charge.providerKey || undefined,
    });
    return respData({ checkout_url: checkout.checkoutInfo.checkoutUrl });
  } catch (error: any) {
    return respErr(error?.message || 'common.checkout_failed');
  }
}

export const Route = createFileRoute('/api/directory/tools/$id/checkout')({
  server: { handlers: { POST } },
});
