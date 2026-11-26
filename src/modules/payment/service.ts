import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  lt,
  ne,
  or,
  sql,
} from 'drizzle-orm';

import { db } from '@/core/db';
import { atomic, AtomicGuardError, guard } from '@/core/db/atomic';
import {
  AlipayProvider,
  CreemProvider,
  DodoProvider,
  PaymentManager,
  StripeProvider,
  WaffoProvider,
  WechatPayProvider,
} from '@/core/payment';
import {
  PaymentStatus,
  PaymentType,
  SubscriptionCycleType,
  type CheckoutSession,
  type PaymentEvent,
  type PaymentOrder,
  type PaymentRefund,
} from '@/core/payment/types';
import { credit, order, subscription } from '@/config/db/schema';
import {
  planAffiliateReward,
  planAffiliateRewardRevoke,
} from '@/modules/affiliates/service';
import { getAllConfigs } from '@/modules/config/service';
import {
  calculateCreditExpirationTime,
  planDeductForRefund,
} from '@/modules/credits/service';
import {
  expireDirectoryAdForSubscription,
  findDirectoryAdReferenceBySubscription,
  planDirectoryAdFulfillment,
  planDirectoryAdRefund,
  planDirectoryToolFulfillment,
  planDirectoryToolRefund,
  renewDirectoryAdForSubscription,
} from '@/modules/directory/payment';
import {
  planGuestPostFulfillment,
  planGuestPostRefund,
} from '@/modules/guest-posts/service';
import {
  notifyGuestPostSubmitted,
  notifyPaymentSuccess,
} from '@/modules/notify/service';
import {
  findByProviderSubscriptionId,
  findBySubscriptionNo,
  SubscriptionStatus,
  updateBySubscriptionNo,
  type NewSubscription,
  type UpdateSubscription,
} from '@/modules/subscriptions/service';
import { getSnowId, getUniSeq, getUuid } from '@/lib/hash';

// --- Order types ---

enum OrderStatus {
  PENDING = 'pending',
  CREATED = 'created',
  PAID = 'paid',
  FAILED = 'failed',
  CANCELED = 'canceled', // abandoned unpaid checkout (not provider-refunded)
  REFUNDING = 'refunding', // claimed by an in-flight refund
  REFUNDED = 'refunded',
}

// A refund stuck in REFUNDING (crash between provider call and DB commit) can
// be retried after this long; provider idempotency keys make the retry safe.
const REFUND_STALE_MS = 5 * 60 * 1000;

// --- Payment Manager ---

let manager: PaymentManager | null = null;
let managerConfigHash = '';

async function getPaymentManager(): Promise<PaymentManager> {
  const configs = await getAllConfigs();
  const c = (key: string) => configs[key] || '';

  // Rebuild manager if provider configs changed
  const hash = JSON.stringify([
    c('stripe_secret_key') || c('stripe_api_key'),
    c('creem_enabled'),
    c('creem_api_key'),
    c('waffo_enabled'),
    c('waffo_merchant_id'),
    c('waffo_private_key'),
    c('waffo_environment'),
    c('dodo_enabled'),
    c('dodo_api_key'),
    c('dodo_webhook_key'),
    c('dodo_environment'),
    c('alipay_app_id'),
    c('wechat_mch_id'),
    c('default_payment_provider'),
  ]);
  if (manager && hash === managerConfigHash) return manager;

  manager = new PaymentManager();
  managerConfigHash = hash;

  const stripeKey = c('stripe_secret_key') || c('stripe_api_key');
  if (stripeKey) {
    const isDefault =
      !c('default_payment_provider') ||
      c('default_payment_provider') === 'stripe';
    manager.addProvider(
      new StripeProvider({
        secretKey: stripeKey,
        publishableKey: c('stripe_publishable_key'),
        signingSecret:
          c('stripe_signing_secret') || c('stripe_webhook_secret') || undefined,
        allowPromotionCodes: true,
        allowedPaymentMethods: ['card', 'wechat_pay', 'alipay'],
      }),
      isDefault
    );
  }

  if (c('creem_enabled') === 'true' && c('creem_api_key')) {
    const isDefault = c('default_payment_provider') === 'creem';
    manager.addProvider(
      new CreemProvider({
        apiKey: c('creem_api_key'),
        signingSecret: c('creem_signing_secret') || undefined,
        environment:
          c('creem_environment') === 'production' ? 'production' : 'sandbox',
      }),
      isDefault
    );
  }

  if (
    c('waffo_enabled') === 'true' &&
    c('waffo_merchant_id') &&
    c('waffo_private_key')
  ) {
    const isDefault = c('default_payment_provider') === 'waffo';
    manager.addProvider(
      new WaffoProvider({
        merchantId: c('waffo_merchant_id'),
        privateKey: c('waffo_private_key'),
        environment:
          c('waffo_environment') === 'prod'
            ? 'prod'
            : c('waffo_environment') === 'test'
              ? 'test'
              : undefined,
      }),
      isDefault
    );
  }

  if (c('dodo_enabled') === 'true' && c('dodo_api_key')) {
    const isDefault = c('default_payment_provider') === 'dodo';
    manager.addProvider(
      new DodoProvider({
        apiKey: c('dodo_api_key'),
        webhookKey: c('dodo_webhook_key') || undefined,
        environment:
          c('dodo_environment') === 'live_mode' ? 'live_mode' : 'test_mode',
      }),
      isDefault
    );
  }

  if (c('alipay_app_id') && c('alipay_private_key')) {
    const isDefault = c('default_payment_provider') === 'alipay';
    manager.addProvider(
      new AlipayProvider({
        appId: c('alipay_app_id'),
        privateKey: c('alipay_private_key'),
        alipayPublicKey: c('alipay_public_key'),
        notifyUrl: c('alipay_notify_url') || undefined,
      }),
      isDefault
    );
  }

  if (c('wechat_mch_id') && c('wechat_private_key')) {
    const isDefault = c('default_payment_provider') === 'wechat';
    manager.addProvider(
      new WechatPayProvider({
        appId: c('wechat_app_id'),
        mchId: c('wechat_mch_id'),
        apiV3Key: c('wechat_api_v3_key'),
        privateKey: c('wechat_private_key'),
        serialNo: c('wechat_serial_no'),
        notifyUrl: c('wechat_notify_url') || undefined,
        platformCert: c('wechat_platform_cert') || undefined,
      }),
      isDefault
    );
  }

  return manager;
}

/** Providers whose checkout needs `<provider>_product_ids_mapping`. */
const MAPPED_PRODUCT_PROVIDERS = ['creem', 'waffo', 'dodo'];

function requiresMappedProviderProduct(provider?: string | null) {
  return Boolean(provider && MAPPED_PRODUCT_PROVIDERS.includes(provider));
}

// --- Checkout ---

export async function createCheckout(params: {
  userId: string;
  userEmail?: string;
  paymentOrder: PaymentOrder;
  provider?: string;
  productName?: string;
  planName?: string;
  credits?: number;
  creditsValidDays?: number;
  /** What the order buys beyond productId, `<kind>:<id>` (order.reference). */
  reference?: string;
}): Promise<CheckoutSession> {
  const {
    userId,
    userEmail,
    paymentOrder,
    provider,
    productName,
    planName,
    credits,
    creditsValidDays,
  } = params;
  const pm = await getPaymentManager();
  if (provider && !pm.getProviderNames().includes(provider)) {
    throw new Error(`Payment provider '${provider}' is not configured`);
  }
  const orderNo = getUniSeq('ORD');
  const configs = await getAllConfigs();
  const appUrl = configs.app_url || 'http://localhost:3000';

  // Resolve provider-specific product ID (Creem / Waffo / Dodo mapping)
  const resolvedProvider = provider || pm.getDefaultProvider()?.name;
  let resolvedProductId = paymentOrder.productId;
  if (
    requiresMappedProviderProduct(resolvedProvider) &&
    paymentOrder.productId
  ) {
    const mapping = configs[`${resolvedProvider}_product_ids_mapping`];
    let mappedProductId = '';
    if (mapping) {
      try {
        const map = JSON.parse(mapping) as Record<string, string>;
        const raw = map[paymentOrder.productId];
        mappedProductId = typeof raw === 'string' ? raw.trim() : '';
        if (mappedProductId) {
          resolvedProductId = mappedProductId;
        }
      } catch {
        // invalid JSON — treat as unmapped
      }
    }
    // Never send catalog ids to Creem/Waffo/Dodo (providers reject them raw).
    if (!mappedProductId || resolvedProductId === paymentOrder.productId) {
      throw new Error('Payment product mapping not configured');
    }
  }

  const finalSuccessUrl =
    paymentOrder.successUrl || `${appUrl}/settings/payments`;
  const callbackSuccessUrl = `${appUrl}/api/payment/callback?order_no=${orderNo}&redirect=${encodeURIComponent(finalSuccessUrl)}`;

  // One checkout → one provider subscription (never merge into an existing
  // same-product sub). Stamp order_no (+ optional specialty reference) so
  // webhooks resolve THIS order, not a sibling seat for the same user.
  const checkoutMetadata: Record<string, string> = {};
  for (const [k, v] of Object.entries(paymentOrder.metadata || {})) {
    if (v != null && v !== '') checkoutMetadata[k] = String(v);
  }
  checkoutMetadata.order_no = orderNo;
  if (params.reference) checkoutMetadata.reference = params.reference;

  const session = await pm.createPayment({
    order: {
      ...paymentOrder,
      productId: resolvedProductId,
      orderNo,
      requestId: paymentOrder.requestId || orderNo,
      metadata: checkoutMetadata,
      // Always quantity 1 — multi-seat = multiple checkouts/subs, not qty.
      quantity: 1,
      successUrl: callbackSuccessUrl,
      cancelUrl:
        paymentOrder.cancelUrl || `${appUrl}/settings/billing?canceled=1`,
    },
    provider,
  });

  await db()
    .insert(order)
    .values({
      id: getUuid(),
      orderNo,
      userId,
      userEmail: userEmail || '',
      status: OrderStatus.CREATED,
      amount: paymentOrder.price?.amount || 0,
      currency: paymentOrder.price?.currency || 'usd',
      productId: paymentOrder.productId || '',
      productName: productName || null,
      planName: planName || null,
      creditsAmount: credits ?? null,
      creditsValidDays: creditsValidDays ?? null,
      paymentType: paymentOrder.type || 'one-time',
      paymentInterval: paymentOrder.plan?.interval || null,
      paymentProvider: session.provider,
      paymentSessionId: session.checkoutInfo.sessionId,
      checkoutInfo: JSON.stringify(session.checkoutInfo),
      checkoutResult: JSON.stringify(session.checkoutResult),
      checkoutUrl: session.checkoutInfo.checkoutUrl,
      description: paymentOrder.description || '',
      reference: params.reference || null,
    });

  return session;
}

// --- Payment callback (return_url) ---

export async function handlePaymentCallback(orderNo: string) {
  // Find the order
  const [existingOrder] = await db()
    .select()
    .from(order)
    .where(eq(order.orderNo, orderNo))
    .limit(1);

  if (!existingOrder) return;

  // Query the payment provider for latest status
  const pm = await getPaymentManager();
  const provider = pm.getProvider(existingOrder.paymentProvider);
  if (!provider) return;

  // Waffo looks up payments by our merchant order no, not checkout session id.
  const sessionId =
    provider.name === 'waffo'
      ? existingOrder.orderNo
      : existingOrder.paymentSessionId || existingOrder.orderNo;

  const session = await provider.getPaymentSession({ sessionId });

  // Providers sometimes omit a stable id; bind to our order so fulfillment
  // can still locate the row via orderNo.
  const result =
    session.paymentResult && typeof session.paymentResult === 'object'
      ? session.paymentResult
      : {};
  session.paymentResult = {
    ...result,
    id: result.id || existingOrder.orderNo || sessionId,
    orderNo: result.orderNo || existingOrder.orderNo,
  };

  // Idempotent: also backfills subscription/credits if an earlier callback
  // marked the order paid before the provider subscription payload arrived.
  await handleCheckoutSuccess(session, existingOrder.paymentProvider);
}

export async function handlePaymentCallbackBySessionId(sessionId: string) {
  if (!sessionId) return;
  const [existingOrder] = await db()
    .select()
    .from(order)
    .where(and(eq(order.paymentSessionId, sessionId), isNull(order.deletedAt)))
    .limit(1);
  if (!existingOrder) return;
  await handlePaymentCallback(existingOrder.orderNo);
}

// --- Webhook handling ---

export async function handleWebhook(params: {
  req: Request;
  provider: string;
}): Promise<PaymentEvent> {
  const pm = await getPaymentManager();
  const event = await pm.getPaymentEvent({
    req: params.req,
    provider: params.provider,
  });
  const session = event.paymentSession;
  if (!session) return event;

  const eventType = event.eventType;

  // Route event to appropriate handler
  if (eventType === 'checkout.success') {
    await handleCheckoutSuccess(session, params.provider);
  } else if (eventType === 'payment.success') {
    if (
      session.paymentInfo?.subscriptionCycleType ===
      SubscriptionCycleType.RENEWAL
    ) {
      await handleSubscriptionRenewal(session, params.provider);
    } else {
      await handleCheckoutSuccess(session, params.provider);
    }
  } else if (eventType === 'subscribe.updated') {
    await handleSubscriptionUpdated(session, params.provider);
  } else if (eventType === 'subscribe.canceled') {
    await handleSubscriptionCanceled(session, params.provider);
  }

  return event;
}

// --- Checkout Success: update order + create subscription + grant credits ---

function collectOrderLookupIds(session: any): string[] {
  const result = session.paymentResult || {};
  const meta = {
    ...(session.metadata || {}),
    ...(result.metadata || {}),
    ...(result.object?.metadata || {}),
  };
  const ids = [
    result.id,
    result.object?.id,
    result.out_trade_no,
    result.outTradeNo,
    result.orderNo,
    result.order_no,
    result.orderMerchantExternalId,
    result.request_id,
    result.requestId,
    result.client_reference_id,
    result.object?.client_reference_id,
    meta.order_no,
    meta.orderNo,
    session.subscriptionResult?.orderNo,
    session.subscriptionResult?.order_no,
  ];
  return [
    ...new Set(
      ids.filter((v): v is string => typeof v === 'string' && v.length > 0)
    ),
  ];
}

/** Locate the checkout order for a provider session (Waffo/Dodo often key by orderNo). */
async function findOrderForPaymentSession(session: any) {
  const ids = collectOrderLookupIds(session);
  for (const sessionId of ids) {
    const [existingOrder] = await db()
      .select()
      .from(order)
      .where(
        and(
          or(
            eq(order.paymentSessionId, sessionId),
            eq(order.orderNo, sessionId)
          ),
          isNull(order.deletedAt),
          // Never attach checkout fulfillment to a renewal row
          or(isNull(order.paymentType), ne(order.paymentType, 'renew'))
        )
      )
      .orderBy(asc(order.createdAt))
      .limit(1);
    if (existingOrder) return existingOrder;
  }

  if (session.subscriptionId) {
    const [bySub] = await db()
      .select()
      .from(order)
      .where(
        and(
          eq(order.subscriptionId, session.subscriptionId),
          isNull(order.deletedAt),
          or(isNull(order.paymentType), ne(order.paymentType, 'renew'))
        )
      )
      .orderBy(asc(order.createdAt))
      .limit(1);
    if (bySub) return bySub;
  }

  return null;
}

async function handleCheckoutSuccess(session: any, provider: string) {
  // Defense: renewal payloads must never create/grant against the original order
  if (
    session.paymentInfo?.subscriptionCycleType ===
      SubscriptionCycleType.RENEWAL &&
    session.subscriptionId
  ) {
    const existingSub = await findByProviderSubscriptionId({
      provider,
      subscriptionId: session.subscriptionId,
    });
    if (existingSub) {
      await handleSubscriptionRenewal(session, provider);
      return;
    }
  }

  const existingOrder = await findOrderForPaymentSession(session);
  if (!existingOrder) return;

  // Already paid: don't fulfill again, only backfill what was missed.
  if (existingOrder.status === OrderStatus.PAID) {
    if (session.paymentStatus === PaymentStatus.SUCCESS) {
      await backfillPaidOrder(existingOrder, session, provider);
    }
    return;
  }

  await settleCheckoutOrder(existingOrder, session, provider);
}

function isSubscriptionOrder(ord: { paymentType?: string | null }): boolean {
  return (
    ord.paymentType === 'subscription' ||
    ord.paymentType === PaymentType.SUBSCRIPTION
  );
}

/**
 * Idempotent repair for an order that is already paid: attach a missing
 * subscription and grant missing credits. Never re-fulfills.
 */
async function backfillPaidOrder(
  existingOrder: typeof order.$inferSelect,
  session: any,
  provider: string
) {
  const subscriptionInfo = session.subscriptionInfo;
  const paymentInfo = session.paymentInfo;

  if (
    !existingOrder.subscriptionNo &&
    isSubscriptionOrder(existingOrder) &&
    subscriptionInfo &&
    session.subscriptionId
  ) {
    const existingByProvider = await findByProviderSubscriptionId({
      provider,
      subscriptionId: session.subscriptionId,
    });
    const subscriptionNo = existingByProvider?.subscriptionNo || getSnowId();

    const newSub: any = !existingByProvider && {
      id: getUuid(),
      subscriptionNo,
      userId: existingOrder.userId,
      userEmail: existingOrder.userEmail || existingOrder.paymentEmail || '',
      status: subscriptionInfo.status || SubscriptionStatus.ACTIVE,
      paymentProvider: provider,
      subscriptionId: session.subscriptionId,
      subscriptionResult: JSON.stringify(session.subscriptionResult),
      productId: existingOrder.productId,
      description: subscriptionInfo.description || 'Subscription Created',
      amount: subscriptionInfo.amount ?? existingOrder.amount,
      currency: subscriptionInfo.currency || existingOrder.currency,
      interval: subscriptionInfo.interval,
      intervalCount: subscriptionInfo.intervalCount,
      trialPeriodDays: subscriptionInfo.trialPeriodDays,
      currentPeriodStart: subscriptionInfo.currentPeriodStart,
      currentPeriodEnd: subscriptionInfo.currentPeriodEnd,
      billingUrl: subscriptionInfo.billingUrl,
      planName: existingOrder.planName || existingOrder.productName,
      productName: existingOrder.productName,
      creditsAmount: existingOrder.creditsAmount,
      creditsValidDays: existingOrder.creditsValidDays,
      paymentProductId: existingOrder.paymentProductId,
      paymentUserId: paymentInfo?.paymentUserId,
    };

    try {
      await atomic((q) => [
        guard({
          table: order,
          column: 'userId',
          where: eq(order.id, existingOrder.id),
          require: or(
            isNull(order.subscriptionNo),
            eq(order.subscriptionNo, '')
          )!,
          message: 'Subscription already attached',
        }),
        q
          .update(order)
          .set({
            subscriptionNo,
            subscriptionId: session.subscriptionId,
            subscriptionResult: JSON.stringify(session.subscriptionResult),
          })
          .where(eq(order.id, existingOrder.id)),
        newSub && q.insert(subscription).values(newSub),
      ]);
      console.warn('[payment] backfilled subscription on paid order', {
        orderNo: existingOrder.orderNo,
        provider,
        subscriptionNo,
      });
    } catch (error) {
      if (!(error instanceof AtomicGuardError)) throw error;
    }
  }

  const credits = existingOrder.creditsAmount || 0;
  if (credits <= 0) return;

  const [refreshed] = await db()
    .select({ subscriptionNo: order.subscriptionNo })
    .from(order)
    .where(eq(order.id, existingOrder.id))
    .limit(1);
  const subscriptionNo =
    refreshed?.subscriptionNo || existingOrder.subscriptionNo || '';

  const newCredit: any = {
    id: getUuid(),
    userId: existingOrder.userId,
    userEmail: existingOrder.userEmail || '',
    orderNo: existingOrder.orderNo,
    subscriptionNo,
    transactionNo: `grant_${existingOrder.orderNo}`,
    transactionType: 'grant',
    transactionScene: isSubscriptionOrder(existingOrder)
      ? 'subscription'
      : 'payment',
    credits,
    remainingCredits: credits,
    description: 'Grant credit',
    expiresAt: calculateCreditExpirationTime({
      creditsValidDays: existingOrder.creditsValidDays || 0,
      currentPeriodEnd: subscriptionInfo?.currentPeriodEnd,
    }),
    status: 'active',
  };

  try {
    await atomic((q) => [
      guard({
        table: order,
        column: 'userId',
        where: eq(order.id, existingOrder.id),
        require: sql`not exists (select 1 from ${credit} where ${credit.orderNo} = ${existingOrder.orderNo} and ${credit.transactionType} = 'grant')`,
        message: 'Credits already granted',
      }),
      q.insert(credit).values(newCredit),
    ]);
    console.warn('[payment] backfilled credits on paid order', {
      orderNo: existingOrder.orderNo,
      provider,
    });
  } catch (error) {
    if (!(error instanceof AtomicGuardError)) throw error;
  }
}

/**
 * Apply a checkout outcome to an order read moments earlier. The read can be
 * stale — a concurrent webhook or callback may have settled the order since —
 * so this re-checks atomically instead of trusting `existingOrder.status`.
 * Exported for tests that replay that race.
 */
export async function settleCheckoutOrder(
  existingOrder: typeof order.$inferSelect,
  session: any,
  provider: string
) {
  // Fast path only; the conditional update below is the real guard.
  if (
    existingOrder.status !== OrderStatus.CREATED &&
    existingOrder.status !== OrderStatus.PENDING
  )
    return;

  const paymentInfo = session.paymentInfo;
  const subscriptionInfo = session.subscriptionInfo;

  if (session.paymentStatus === PaymentStatus.SUCCESS) {
    // CNY providers charge exactly the order amount (no coupons or tax on
    // their side), so any mismatch means the notification belongs to some
    // other trade — refuse to settle rather than grant on the wrong payment.
    if (
      (provider === 'alipay' || provider === 'wechat') &&
      paymentInfo?.amount !== existingOrder.amount
    ) {
      throw new Error(
        `Paid amount ${paymentInfo?.amount} does not match order ${existingOrder.orderNo} amount ${existingOrder.amount}`
      );
    }

    // Prepare order update
    const orderUpdate: Record<string, any> = {
      status: OrderStatus.PAID,
      paymentResult: JSON.stringify(session.paymentResult),
      paymentAmount: paymentInfo?.paymentAmount ?? null,
      paymentCurrency: paymentInfo?.paymentCurrency || null,
      paymentEmail: paymentInfo?.paymentEmail || null,
      paidAt: paymentInfo?.paidAt || new Date(),
      transactionId: paymentInfo?.transactionId || null,
      invoiceId: paymentInfo?.invoiceId || null,
      invoiceUrl: paymentInfo?.invoiceUrl || null,
      paymentUserName: paymentInfo?.paymentUserName || null,
      paymentUserId: paymentInfo?.paymentUserId || null,
      discountCode: paymentInfo?.discountCode || null,
      discountAmount: paymentInfo?.discountAmount || null,
    };

    // The webhook and the synchronous return (callback) both land here, often
    // at the same moment, so the status check above is only a fast path. The
    // guard re-checks inside the atomic write: exactly one caller moves the
    // order out of created/pending, and only that caller's grants commit —
    // all of it or none (D1 included; see core/db/atomic).
    const subscriptionNo =
      subscriptionInfo && session.subscriptionId ? getSnowId() : undefined;
    if (subscriptionNo) {
      orderUpdate.subscriptionNo = subscriptionNo;
      orderUpdate.subscriptionId = session.subscriptionId;
      orderUpdate.subscriptionResult = JSON.stringify(
        session.subscriptionResult
      );
    }

    const newSub: any = subscriptionNo && {
      id: getUuid(),
      subscriptionNo,
      userId: existingOrder.userId,
      userEmail: existingOrder.userEmail || existingOrder.paymentEmail || '',
      status: subscriptionInfo.status || SubscriptionStatus.ACTIVE,
      paymentProvider: provider,
      subscriptionId: session.subscriptionId,
      subscriptionResult: JSON.stringify(session.subscriptionResult),
      productId: existingOrder.productId,
      description: subscriptionInfo.description || 'Subscription Created',
      amount: subscriptionInfo.amount,
      currency: subscriptionInfo.currency,
      interval: subscriptionInfo.interval,
      intervalCount: subscriptionInfo.intervalCount,
      trialPeriodDays: subscriptionInfo.trialPeriodDays,
      currentPeriodStart: subscriptionInfo.currentPeriodStart,
      currentPeriodEnd: subscriptionInfo.currentPeriodEnd,
      billingUrl: subscriptionInfo.billingUrl,
      planName: existingOrder.planName || existingOrder.productName,
      productName: existingOrder.productName,
      creditsAmount: existingOrder.creditsAmount,
      creditsValidDays: existingOrder.creditsValidDays,
      paymentProductId: existingOrder.paymentProductId,
      paymentUserId: paymentInfo?.paymentUserId,
    };

    const credits = existingOrder.creditsAmount || 0;
    const newCredit: any = credits > 0 && {
      id: getUuid(),
      userId: existingOrder.userId,
      userEmail: existingOrder.userEmail || '',
      orderNo: existingOrder.orderNo,
      subscriptionNo: subscriptionNo || '',
      // One grant per order, enforced by the unique transaction_no.
      transactionNo: `grant_${existingOrder.orderNo}`,
      transactionType: 'grant',
      transactionScene:
        existingOrder.paymentType === 'subscription'
          ? 'subscription'
          : 'payment',
      credits,
      remainingCredits: credits,
      description: 'Grant credit',
      expiresAt: calculateCreditExpirationTime({
        creditsValidDays: existingOrder.creditsValidDays || 0,
        currentPeriodEnd: subscriptionInfo?.currentPeriodEnd,
      }),
      status: 'active',
    };

    // Guest post / directory orders fulfill in the same write.
    const guestPost = planGuestPostFulfillment(existingOrder);
    const directoryTool = planDirectoryToolFulfillment({
      orderNo: existingOrder.orderNo,
      reference: existingOrder.reference,
      productId: existingOrder.productId,
    });
    const directoryAd = planDirectoryAdFulfillment({
      orderNo: existingOrder.orderNo,
      reference: existingOrder.reference,
      productId: existingOrder.productId,
    });
    // Affiliate reward (the buyer's inviter), in the same write.
    const affiliateReward = await planAffiliateReward({
      ...existingOrder,
      paymentAmount: paymentInfo?.paymentAmount,
    });

    let claimed = false;
    try {
      await atomic((q) => [
        // 1. Claim: only an unpaid order can be settled.
        guard({
          table: order,
          column: 'userId',
          where: eq(order.id, existingOrder.id),
          // Unpaid, never paid before, and nothing granted for it yet: the
          // status alone isn't enough if anything ever moves a paid order back.
          require: and(
            inArray(order.status, [OrderStatus.CREATED, OrderStatus.PENDING]),
            isNull(order.paidAt),
            sql`not exists (select 1 from ${credit} where ${credit.orderNo} = ${existingOrder.orderNo} and ${credit.transactionType} = 'grant')`
          )!,
          message: 'Order already settled',
        }),
        q.update(order).set(orderUpdate).where(eq(order.id, existingOrder.id)),
        // 2. Subscription, 3. credits.
        newSub && q.insert(subscription).values(newSub),
        newCredit && q.insert(credit).values(newCredit),
        // 4. Guest post: the paid draft enters review.
        ...(guestPost ? guestPost.steps(q) : []),
        // 5. Directory premium listing / sponsor ad.
        ...(directoryTool ? directoryTool.steps(q) : []),
        ...(directoryAd ? directoryAd.steps(q) : []),
        ...(affiliateReward ? affiliateReward(q) : []),
      ]);
      claimed = true;
    } catch (error) {
      if (!(error instanceof AtomicGuardError)) throw error;
      // another request already handled it
    }

    // Outside the transaction: only announce orders that actually committed,
    // and only from the request that claimed them.
    if (claimed) {
      await notifyPaymentSuccess(existingOrder.orderNo);
      if (guestPost) await notifyGuestPostSubmitted(guestPost.guestPostId);
    }
  } else if (
    session.paymentStatus === PaymentStatus.FAILED ||
    session.paymentStatus === PaymentStatus.CANCELED
  ) {
    await db()
      .update(order)
      .set({
        status: OrderStatus.FAILED,
        paymentResult: JSON.stringify(session.paymentResult),
      })
      .where(
        and(
          eq(order.id, existingOrder.id),
          inArray(order.status, [OrderStatus.CREATED, OrderStatus.PENDING])
        )
      );
  }
}

// --- Subscription Renewal ---

export async function handleSubscriptionRenewal(
  session: any,
  provider: string
) {
  if (!session.subscriptionId || !session.subscriptionInfo) return;

  const existingSub = await findByProviderSubscriptionId({
    provider,
    subscriptionId: session.subscriptionId,
  });
  if (!existingSub || !existingSub.amount || !existingSub.currency) return;

  const subscriptionInfo = session.subscriptionInfo;
  if (
    !subscriptionInfo.currentPeriodStart ||
    !subscriptionInfo.currentPeriodEnd
  )
    return;

  if (session.paymentStatus !== PaymentStatus.SUCCESS) return;

  const paymentInfo = session.paymentInfo;

  // Idempotency: drop duplicate renewals for the same provider transaction.
  if (paymentInfo?.transactionId) {
    const [dup] = await db()
      .select({ id: order.id })
      .from(order)
      .where(
        and(
          eq(order.transactionId, paymentInfo.transactionId),
          eq(order.paymentProvider, provider)
        )
      )
      .limit(1);
    if (dup) return;
  }

  const renewalOrderNo = getSnowId();

  const credits = existingSub.creditsAmount || 0;
  const newCredit: any = credits > 0 && {
    id: getUuid(),
    userId: existingSub.userId,
    userEmail: existingSub.userEmail || '',
    orderNo: renewalOrderNo,
    subscriptionNo: existingSub.subscriptionNo,
    transactionNo: `grant_${renewalOrderNo}`,
    transactionType: 'grant',
    transactionScene: 'renewal',
    credits,
    remainingCredits: credits,
    description: 'Grant credit',
    expiresAt: calculateCreditExpirationTime({
      creditsValidDays: existingSub.creditsValidDays || 0,
      currentPeriodEnd: subscriptionInfo.currentPeriodEnd,
    }),
    status: 'active',
  };

  // Directory sponsor: resolve ad before the atomic write so claim + extend
  // commit together (avoids charged-but-not-extended when renew fails after claim).
  const isDirectorySponsor = Boolean(
    existingSub.productId?.startsWith('directory_sponsor_')
  );
  let directoryAdRenewal: ReturnType<typeof planDirectoryAdFulfillment> = null;
  if (isDirectorySponsor) {
    const adReference = await findDirectoryAdReferenceBySubscription(
      existingSub.subscriptionNo
    );
    directoryAdRenewal = planDirectoryAdFulfillment({
      orderNo: renewalOrderNo,
      reference: adReference,
      productId: existingSub.productId,
      periodEnd: subscriptionInfo.currentPeriodEnd,
    });
  }

  // A free trial's first real charge arrives as a renewal: it may be the
  // buyer's first payment, so it can earn the inviter's commission.
  const affiliateReward = await planAffiliateReward({
    userId: existingSub.userId,
    orderNo: renewalOrderNo,
    amount: existingSub.amount,
    currency: existingSub.currency,
    paymentAmount: paymentInfo?.paymentAmount,
  });

  let claimed = false;
  try {
    await atomic((q) => [
      // 1. Claim the renewal by advancing the subscription period. The
      //    transactionId check above is racy (the provider retries, and several
      //    events can describe one invoice); only one caller can move the period
      //    start forward, and only that caller's order and credits commit.
      guard({
        table: subscription,
        column: 'userId',
        where: eq(subscription.subscriptionNo, existingSub.subscriptionNo),
        // D1 rejects bound Date params; period columns are timestamp_ms.
        require: or(
          isNull(subscription.currentPeriodStart),
          sql`${subscription.currentPeriodStart} < ${new Date(subscriptionInfo.currentPeriodStart).getTime()}`
        )!,
        message: 'Period already renewed',
      }),
      q
        .update(subscription)
        .set({
          currentPeriodStart: subscriptionInfo.currentPeriodStart,
          currentPeriodEnd: subscriptionInfo.currentPeriodEnd,
        })
        .where(eq(subscription.subscriptionNo, existingSub.subscriptionNo)),
      // 2. Renewal order, 3. renewal credits.
      q.insert(order).values({
        id: getUuid(),
        orderNo: renewalOrderNo,
        userId: existingSub.userId,
        userEmail: existingSub.userEmail || '',
        status: OrderStatus.PAID,
        amount: existingSub.amount,
        currency: existingSub.currency,
        productId: existingSub.productId || '',
        paymentType: 'renew',
        paymentInterval: existingSub.interval || '',
        paymentProvider: provider,
        checkoutInfo: '',
        description: 'Subscription Renewal',
        productName: existingSub.productName || '',
        planName: existingSub.planName || '',
        creditsAmount: existingSub.creditsAmount,
        creditsValidDays: existingSub.creditsValidDays,
        paymentProductId: existingSub.paymentProductId || '',
        paymentResult: JSON.stringify(session.paymentResult),
        paymentAmount: paymentInfo?.paymentAmount,
        paymentCurrency: paymentInfo?.paymentCurrency,
        paymentEmail: paymentInfo?.paymentEmail,
        paidAt: paymentInfo?.paidAt || new Date(),
        invoiceId: paymentInfo?.invoiceId,
        invoiceUrl: paymentInfo?.invoiceUrl,
        subscriptionNo: existingSub.subscriptionNo,
        subscriptionId: session.subscriptionId,
        transactionId: paymentInfo?.transactionId,
        paymentUserName: paymentInfo?.paymentUserName,
        paymentUserId: paymentInfo?.paymentUserId,
        reference: directoryAdRenewal
          ? `directory_ad:${directoryAdRenewal.adId}`
          : null,
      }),
      newCredit && q.insert(credit).values(newCredit),
      // 4. Sponsor ad placement extends in the same atomic write as the claim.
      ...(directoryAdRenewal ? directoryAdRenewal.steps(q) : []),
      ...(affiliateReward ? affiliateReward(q) : []),
    ]);
    claimed = true;
  } catch (error) {
    if (!(error instanceof AtomicGuardError)) throw error;
    // Period already claimed — still heal ad extension if a prior attempt
    // advanced the period but failed before the placement write (legacy path
    // or a crashed worker). Idempotent: endsAt → periodEnd. Rethrow heal
    // failures so the provider webhook can retry the whole event.
    if (isDirectorySponsor) {
      await renewDirectoryAdForSubscription({
        subscriptionNo: existingSub.subscriptionNo,
        productId: existingSub.productId,
        periodEnd: subscriptionInfo.currentPeriodEnd,
      });
    }
  }

  if (claimed) {
    await notifyPaymentSuccess(renewalOrderNo);
  }
}

// --- Subscription Updated ---

async function handleSubscriptionUpdated(session: any, provider: string) {
  if (!session.subscriptionId || !session.subscriptionInfo) return;

  const existingSub = await findByProviderSubscriptionId({
    provider,
    subscriptionId: session.subscriptionId,
  });
  if (!existingSub) return;

  const info = session.subscriptionInfo;
  // Never blank out a known local status with a partial provider payload.
  if (!info.status) return;

  await updateBySubscriptionNo(existingSub.subscriptionNo, {
    status: info.status,
    // Period is written below (forward-only) so a reordered
    // subscription.updated cannot rewind same-cycle / first-period guards.
    canceledAt: info.canceledAt || null,
    canceledEndAt: info.canceledEndAt || null,
    canceledReason: info.canceledReason || '',
    canceledReasonType: info.canceledReasonType || '',
  });

  if (info.currentPeriodStart && info.currentPeriodEnd) {
    await db()
      .update(subscription)
      .set({
        currentPeriodStart: info.currentPeriodStart,
        currentPeriodEnd: info.currentPeriodEnd,
      })
      .where(
        and(
          eq(subscription.subscriptionNo, existingSub.subscriptionNo),
          or(
            isNull(subscription.currentPeriodStart),
            lt(subscription.currentPeriodStart, info.currentPeriodStart)
          )
        )
      );
  }
}

// --- Subscription Canceled ---

async function handleSubscriptionCanceled(session: any, provider: string) {
  if (!session.subscriptionId || !session.subscriptionInfo) return;

  const existingSub = await findByProviderSubscriptionId({
    provider,
    subscriptionId: session.subscriptionId,
  });
  if (!existingSub) return;

  const info = session.subscriptionInfo;
  await updateBySubscriptionNo(existingSub.subscriptionNo, {
    status: SubscriptionStatus.CANCELED,
    canceledAt: info.canceledAt,
    canceledEndAt: info.canceledEndAt,
    canceledReason: info.canceledReason,
    canceledReasonType: info.canceledReasonType,
  });

  // Sponsor seats: free inventory when the subscription is fully gone
  // (period-end cancel completing, or provider immediate cancel webhook).
  try {
    await expireDirectoryAdForSubscription(existingSub.subscriptionNo);
  } catch (err) {
    console.error('[handleSubscriptionCanceled] expire sponsor ad', {
      subscriptionNo: existingSub.subscriptionNo,
      err,
    });
  }
}

/**
 * Close open provider Checkout Sessions before locally abandoning an unpaid
 * order. Returns `alreadyComplete: true` when any session is already paid —
 * callers MUST NOT cancel the order in that case (settle would skip a canceled
 * order → money with no fulfillment). Stripe is expired; other providers are
 * probed via getPaymentSession when available.
 */
export async function expireOpenCheckoutSessions(
  sessions: {
    paymentProvider?: string | null;
    paymentSessionId?: string | null;
  }[]
): Promise<{ alreadyComplete: boolean }> {
  const pm = await getPaymentManager();
  let alreadyComplete = false;

  for (const s of sessions) {
    const sessionId = s.paymentSessionId?.trim();
    const providerName = s.paymentProvider?.trim();
    if (!sessionId || !providerName) continue;

    const provider = pm.getProvider(providerName) as
      | {
          getPaymentSession?: (p: {
            sessionId: string;
          }) => Promise<{ paymentStatus?: string }>;
          expireCheckoutSession?: (p: { sessionId: string }) => Promise<void>;
        }
      | undefined;
    if (!provider) continue;

    // Probe first: a completed session must abort local abandon.
    if (provider.getPaymentSession) {
      try {
        const session = await provider.getPaymentSession({ sessionId });
        if (session.paymentStatus === PaymentStatus.SUCCESS) {
          alreadyComplete = true;
          continue;
        }
      } catch (err: any) {
        // Missing / unknown session — treat as not payable; still try expire.
        const msg = String(err?.message || err || '');
        if (
          !/No such checkout\.session|not found|get payment failed/i.test(msg)
        ) {
          console.error('[expireOpenCheckoutSessions] probe', sessionId, err);
        }
      }
    }

    if (providerName !== 'stripe' || !provider.expireCheckoutSession) continue;

    try {
      await provider.expireCheckoutSession({ sessionId });
    } catch (err: any) {
      const msg = String(err?.message || err || '');
      // Stripe: complete/paid → abort. Already expired / missing → safe to abandon.
      if (
        /\bcomplete\b|\bpaid\b/i.test(msg) &&
        /cannot be expired|expire/i.test(msg)
      ) {
        alreadyComplete = true;
        continue;
      }
      if (
        /already expired|No such checkout\.session/i.test(msg) ||
        (/cannot be expired/i.test(msg) && /expired/i.test(msg))
      ) {
        continue;
      }
      console.error('[expireOpenCheckoutSessions]', sessionId, err);
    }
  }

  return { alreadyComplete };
}

// --- Cancel subscription (user-initiated) ---

export async function cancelUserSubscription(params: {
  userId: string;
  subscriptionNo: string;
  /** End now (refund / force take-down). Default: stop renew at period end. */
  immediate?: boolean;
}) {
  const { userId, subscriptionNo, immediate } = params;

  const sub = await findBySubscriptionNo(subscriptionNo);
  if (!sub) throw new Error('Subscription not found');
  if (sub.userId !== userId) throw new Error('Forbidden');

  if (
    sub.status === SubscriptionStatus.CANCELED ||
    sub.status === SubscriptionStatus.EXPIRED
  ) {
    // Heal: prior cancel may have missed freeing a sponsor seat.
    try {
      await expireDirectoryAdForSubscription(subscriptionNo);
    } catch {
      // ignore
    }
    return sub;
  }
  // Already scheduled to end — nothing more for a period-end cancel.
  if (!immediate && sub.status === SubscriptionStatus.PENDING_CANCEL) {
    return sub;
  }

  const pm = await getPaymentManager();
  const provider = pm.getProvider(sub.paymentProvider);
  if (!provider || !provider.cancelSubscription) {
    throw new Error('Cancellation not supported for this provider');
  }

  const session = await provider.cancelSubscription({
    subscriptionId: sub.subscriptionId,
    immediate: immediate || undefined,
  });

  const info = session.subscriptionInfo;
  // Period-end intent must not stay ACTIVE if the provider omits cancel flags.
  // If the provider only supports immediate cancel, honor CANCELED and free seats.
  const nextStatus = immediate
    ? info?.status || SubscriptionStatus.CANCELED
    : info?.status === SubscriptionStatus.CANCELED
      ? SubscriptionStatus.CANCELED
      : SubscriptionStatus.PENDING_CANCEL;
  const updated = await updateBySubscriptionNo(subscriptionNo, {
    status: nextStatus,
    canceledAt: info?.canceledAt || new Date(),
    canceledEndAt:
      info?.canceledEndAt || (!immediate ? sub.currentPeriodEnd || null : null),
    canceledReason: info?.canceledReason || 'Canceled by user',
    canceledReasonType: info?.canceledReasonType || 'user_request',
  });

  // Immediate / provider-already-canceled: free sponsor seat now.
  // Period-end (pending_cancel) keeps the ad until the period (or webhook) ends.
  if (nextStatus === SubscriptionStatus.CANCELED) {
    try {
      await expireDirectoryAdForSubscription(subscriptionNo);
    } catch (err) {
      console.error('[cancelUserSubscription] expire sponsor ad', {
        subscriptionNo,
        err,
      });
    }
  }

  return updated;
}

// --- Refund (admin-initiated) ---

export async function refundOrder(params: {
  orderNo: string;
  operatorId: string;
  reason?: string;
  deductCredits?: number; // defaults to the credits this order granted
  cancelSubscription?: boolean;
}) {
  const { orderNo, operatorId, reason } = params;

  const [existingOrder] = await db()
    .select()
    .from(order)
    .where(and(eq(order.orderNo, orderNo), isNull(order.deletedAt)))
    .limit(1);
  if (!existingOrder) throw new Error('Order not found');

  const staleBefore = new Date(Date.now() - REFUND_STALE_MS);
  if (
    existingOrder.status !== OrderStatus.PAID &&
    !(
      existingOrder.status === OrderStatus.REFUNDING &&
      existingOrder.updatedAt < staleBefore
    )
  ) {
    throw new Error(
      existingOrder.status === OrderStatus.REFUNDING
        ? 'A refund for this order is already in progress'
        : `Only paid orders can be refunded (status: ${existingOrder.status})`
    );
  }

  // Resolve the provider BEFORE claiming. getProvider() falls back to the
  // default provider, so check the name — never refund through the wrong one.
  const paidAmount = existingOrder.paymentAmount ?? existingOrder.amount;
  const pm = await getPaymentManager();
  const provider = pm.getProvider(existingOrder.paymentProvider);
  if (paidAmount > 0) {
    if (
      !provider ||
      provider.name !== existingOrder.paymentProvider ||
      !provider.refundPayment
    ) {
      throw new Error(
        `Refund is not supported for provider '${existingOrder.paymentProvider}' (not configured or no refund API)`
      );
    }
  }

  // 1. Claim the order so a double click can't refund twice. The token
  //    check works on every dialect without relying on affected-row counts.
  const claim = JSON.stringify({ claim: getUuid() });
  await db()
    .update(order)
    .set({ status: OrderStatus.REFUNDING, refundResult: claim })
    .where(
      and(
        eq(order.id, existingOrder.id),
        or(
          eq(order.status, OrderStatus.PAID),
          and(
            eq(order.status, OrderStatus.REFUNDING),
            // D1 rejects bound Date params; updatedAt is timestamp_ms.
            sql`${order.updatedAt} < ${staleBefore.getTime()}`
          )
        )
      )
    );
  const [claimed] = await db()
    .select({ refundResult: order.refundResult })
    .from(order)
    .where(eq(order.id, existingOrder.id))
    .limit(1);
  if (claimed?.refundResult !== claim) {
    throw new Error('A refund for this order is already in progress');
  }

  // 2. Refund at the provider. On failure, release the claim.
  let refund: PaymentRefund | null = null;
  if (paidAmount > 0 && provider?.refundPayment) {
    try {
      refund = await provider.refundPayment({
        orderNo: existingOrder.orderNo,
        sessionId: existingOrder.paymentSessionId || undefined,
        transactionId: existingOrder.transactionId || undefined,
        invoiceId: existingOrder.invoiceId || undefined,
        paymentType: existingOrder.paymentType || undefined,
        amount: paidAmount,
        currency: existingOrder.paymentCurrency || existingOrder.currency,
        reason,
      });
    } catch (error) {
      await db()
        .update(order)
        .set({ status: OrderStatus.PAID, refundResult: null })
        .where(
          and(eq(order.id, existingOrder.id), eq(order.refundResult, claim))
        );
      throw error;
    }
  }

  // 3. Atomically deduct credits + mark the order refunded.
  const creditsToDeduct = Math.max(
    0,
    Math.floor(params.deductCredits ?? existingOrder.creditsAmount ?? 0)
  );
  const refundAmount = refund?.amount ?? paidAmount;
  let creditsDeducted = 0;
  try {
    const deduction = await planDeductForRefund({
      userId: existingOrder.userId,
      userEmail: existingOrder.userEmail || '',
      orderNo: existingOrder.orderNo,
      credits: creditsToDeduct,
      description: `Refund ${existingOrder.orderNo}`,
    });
    await atomic((q) => [
      guard({
        table: order,
        column: 'userId',
        where: eq(order.id, existingOrder.id),
        require: and(
          eq(order.status, OrderStatus.REFUNDING),
          eq(order.refundResult, claim)
        )!,
        message: 'Order refund claim lost',
      }),
      ...deduction.steps(q),
      // A refunded guest post order rejects (or takes down) its submission.
      ...planGuestPostRefund(existingOrder.orderNo)(q),
      ...(planDirectoryToolRefund({ reference: existingOrder.reference })?.(
        q
      ) ?? []),
      ...(planDirectoryAdRefund({ reference: existingOrder.reference })?.(q) ??
        []),
      // A refunded order takes back its affiliate commission.
      ...planAffiliateRewardRevoke(existingOrder.orderNo)(q),
      q
        .update(order)
        .set({
          status: OrderStatus.REFUNDED,
          refundAmount,
          refundedAt: new Date(),
          refundResult: JSON.stringify({
            refundId: refund?.refundId || null,
            status: refund?.status || 'succeeded',
            reason: reason || '',
            operatorId,
            creditsDeducted: deduction.deducted,
            providerResult: refund?.refundResult ?? null,
          }),
        })
        .where(eq(order.id, existingOrder.id)),
    ]);
    creditsDeducted = deduction.deducted;
  } catch (error: any) {
    // The provider has already refunded; leave the order in REFUNDING so it
    // can be retried (idempotently) instead of looking like a paid order.
    throw new Error(
      `Refund was issued at the provider but saving it failed: ${error?.message || error}. Retry in a few minutes.`
    );
  }

  // 4. Optionally cancel the subscription — best effort, after the refund
  //    is recorded, so a cancel failure never hides a completed refund.
  let subscriptionCanceled = false;
  let subscriptionError: string | undefined;
  if (params.cancelSubscription && existingOrder.subscriptionNo) {
    try {
      const sub = await findBySubscriptionNo(existingOrder.subscriptionNo);
      if (
        sub &&
        sub.status !== SubscriptionStatus.CANCELED &&
        sub.status !== SubscriptionStatus.EXPIRED
      ) {
        const subProvider = pm.getProvider(sub.paymentProvider);
        if (
          !subProvider ||
          subProvider.name !== sub.paymentProvider ||
          !subProvider.cancelSubscription
        ) {
          throw new Error('Cancellation not supported for this provider');
        }
        const session = await subProvider.cancelSubscription({
          subscriptionId: sub.subscriptionId,
          immediate: true,
        });
        const info = session.subscriptionInfo;
        await updateBySubscriptionNo(sub.subscriptionNo, {
          status: info?.status || SubscriptionStatus.CANCELED,
          canceledAt: info?.canceledAt || new Date(),
          canceledEndAt: info?.canceledEndAt || null,
          canceledReason: reason || 'Refunded by admin',
          canceledReasonType: 'refund',
        });
      }
      subscriptionCanceled = true;
    } catch (error: any) {
      subscriptionError = error?.message || String(error);
    }
  }

  return {
    orderNo: existingOrder.orderNo,
    refundId: refund?.refundId || null,
    refundStatus: refund?.status || 'succeeded',
    refundAmount,
    creditsDeducted,
    creditsRequested: creditsToDeduct,
    subscriptionCanceled,
    subscriptionError,
  };
}

// --- Query helpers ---

export async function getUserOrders(userId: string) {
  return db()
    .select()
    .from(order)
    .where(and(eq(order.userId, userId), isNull(order.deletedAt)))
    .orderBy(desc(order.createdAt));
}

/**
 * Fill in the missing Stripe invoice link for paid orders listed on a page.
 * Orders settled from a checkout session before the provider looked the
 * invoice up have `invoiceId` but no `invoiceUrl`, so the payments page showed
 * no invoice. Looks each one up once and saves it, so later reads are free.
 * Best effort and capped per call: a failed lookup leaves the row unchanged.
 * Returns a map of order id → invoice URL for the rows it filled.
 */
export async function fillMissingInvoiceUrls(
  rows: {
    id: string;
    status: string | null;
    paymentProvider: string | null;
    invoiceId: string | null;
    invoiceUrl: string | null;
  }[],
  options: {
    limit?: number;
    /** Tests replace the Stripe lookup. */
    lookup?: (invoiceId: string) => Promise<string | undefined>;
  } = {}
): Promise<Map<string, string>> {
  const limit = options.limit ?? 10;
  const filled = new Map<string, string>();
  const missing = rows
    .filter(
      (r) =>
        r.paymentProvider === 'stripe' &&
        r.invoiceId &&
        !r.invoiceUrl &&
        r.status !== OrderStatus.CREATED &&
        r.status !== OrderStatus.PENDING
    )
    .slice(0, limit);
  if (missing.length === 0) return filled;

  let lookup = options.lookup;
  if (!lookup) {
    const provider = (await getPaymentManager()).getProvider('stripe');
    if (!provider?.getPaymentInvoice) return filled;
    lookup = async (invoiceId) =>
      (await provider.getPaymentInvoice!({ invoiceId })).invoiceUrl;
  }

  await Promise.all(
    missing.map(async (r) => {
      try {
        const url = await lookup(r.invoiceId!);
        if (!url || !/^https:\/\//.test(url)) return;
        await db()
          .update(order)
          .set({ invoiceUrl: url })
          .where(
            and(
              eq(order.id, r.id),
              or(isNull(order.invoiceUrl), eq(order.invoiceUrl, ''))
            )
          );
        filled.set(r.id, url);
      } catch (error) {
        console.warn('fill invoice url failed', r.id, error);
      }
    })
  );
  return filled;
}
