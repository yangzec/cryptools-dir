/**
 * Authoritative pricing catalog.
 *
 * The checkout API uses this as the SOURCE OF TRUTH for price/credits/duration.
 * Any price, credits, or plan info sent by the client is IGNORED — only the
 * product_id is honored, and everything else is looked up here.
 *
 * To change pricing, edit this file and redeploy. Admin UI cannot alter prices.
 */

import { PaymentInterval, PaymentType } from '@/core/payment/types';

export type PricingPlanInfo = {
  name: string;
  interval: PaymentInterval;
  intervalCount: number;
};

export type PricingProduct = {
  productId: string;
  productName: string;
  planName: string;
  description: string;
  type: PaymentType;
  priceInCents: number;
  currency: string;
  /**
   * Price in fen for CNY-only providers (Alipay, WeChat Pay) when `currency`
   * isn't CNY. Without it those providers refuse the product — the amount is
   * never reused across currencies.
   */
  cnyPriceInCents?: number;
  credits: number;
  creditsValidDays?: number;
  plan?: PricingPlanInfo;
  /**
   * 'guest_post': a guest post package. Sold only through
   * /api/guest-posts/$id/checkout (tied to an approved submission); the
   * generic checkout refuses it.
   * 'directory_submit' / 'directory_sponsor': directory checkout APIs only.
   */
  kind?: 'guest_post' | 'directory_submit' | 'directory_sponsor';
  /** Guest post packages: most external links the article may contain. */
  maxLinks?: number;
  /** Directory premium listing / sponsor placement length in days. */
  featuredDays?: number;
};

/**
 * Default demo catalog. Replace with your real products when launching.
 * Keys MUST match what the pricing UI sends as product_id.
 */
export const pricingCatalog: Record<string, PricingProduct> = {
  starter_monthly: {
    productId: 'starter_monthly',
    productName: 'Starter',
    planName: 'Starter',
    description: 'Starter Monthly',
    type: PaymentType.SUBSCRIPTION,
    priceInCents: 900,
    currency: 'usd',
    credits: 5000,
    plan: {
      name: 'Starter',
      interval: PaymentInterval.MONTH,
      intervalCount: 1,
    },
  },
  pro_monthly: {
    productId: 'pro_monthly',
    productName: 'Pro',
    planName: 'Pro',
    description: 'Pro Monthly',
    type: PaymentType.SUBSCRIPTION,
    priceInCents: 2900,
    currency: 'usd',
    credits: 50000,
    plan: { name: 'Pro', interval: PaymentInterval.MONTH, intervalCount: 1 },
  },
  enterprise_monthly: {
    productId: 'enterprise_monthly',
    productName: 'Enterprise',
    planName: 'Enterprise',
    description: 'Enterprise Monthly',
    type: PaymentType.SUBSCRIPTION,
    priceInCents: 9900,
    currency: 'usd',
    credits: 500000,
    plan: {
      name: 'Enterprise',
      interval: PaymentInterval.MONTH,
      intervalCount: 1,
    },
  },
  starter_yearly: {
    productId: 'starter_yearly',
    productName: 'Starter',
    planName: 'Starter',
    description: 'Starter Yearly',
    type: PaymentType.SUBSCRIPTION,
    priceInCents: 8600,
    currency: 'usd',
    credits: 60000,
    plan: { name: 'Starter', interval: PaymentInterval.YEAR, intervalCount: 1 },
  },
  pro_yearly: {
    productId: 'pro_yearly',
    productName: 'Pro',
    planName: 'Pro',
    description: 'Pro Yearly',
    type: PaymentType.SUBSCRIPTION,
    priceInCents: 27800,
    currency: 'usd',
    credits: 600000,
    plan: { name: 'Pro', interval: PaymentInterval.YEAR, intervalCount: 1 },
  },
  enterprise_yearly: {
    productId: 'enterprise_yearly',
    productName: 'Enterprise',
    planName: 'Enterprise',
    description: 'Enterprise Yearly',
    type: PaymentType.SUBSCRIPTION,
    priceInCents: 95000,
    currency: 'usd',
    credits: 6000000,
    plan: {
      name: 'Enterprise',
      interval: PaymentInterval.YEAR,
      intervalCount: 1,
    },
  },
  starter_lifetime: {
    productId: 'starter_lifetime',
    productName: 'Starter',
    planName: 'Starter Lifetime',
    description: 'Starter Lifetime',
    type: PaymentType.ONE_TIME,
    priceInCents: 14900,
    currency: 'usd',
    credits: 100000,
  },
  pro_lifetime: {
    productId: 'pro_lifetime',
    productName: 'Pro',
    planName: 'Pro Lifetime',
    description: 'Pro Lifetime',
    type: PaymentType.ONE_TIME,
    priceInCents: 49900,
    currency: 'usd',
    credits: 1000000,
  },
  enterprise_lifetime: {
    productId: 'enterprise_lifetime',
    productName: 'Enterprise',
    planName: 'Enterprise Lifetime',
    description: 'Enterprise Lifetime',
    type: PaymentType.ONE_TIME,
    priceInCents: 199900,
    currency: 'usd',
    credits: 10000000,
  },

  // Guest posts (see src/modules/guest-posts). Published permanently, every
  // external link rendered rel="sponsored nofollow".
  guest_post_standard: {
    productId: 'guest_post_standard',
    productName: 'Guest Post',
    planName: 'Standard',
    description: 'Guest post (1 link)',
    type: PaymentType.ONE_TIME,
    priceInCents: 9900,
    currency: 'usd',
    cnyPriceInCents: 69900,
    credits: 0,
    kind: 'guest_post',
    maxLinks: 1,
  },
  guest_post_premium: {
    productId: 'guest_post_premium',
    productName: 'Guest Post',
    planName: 'Premium',
    description: 'Guest post (3 links)',
    type: PaymentType.ONE_TIME,
    priceInCents: 19900,
    currency: 'usd',
    cnyPriceInCents: 139900,
    credits: 0,
    kind: 'guest_post',
    maxLinks: 3,
  },

  // Directory tool submit (premium listing) — /api/directory/tools/$id/checkout
  directory_submit_premium: {
    productId: 'directory_submit_premium',
    productName: 'Directory Listing',
    planName: 'Premium',
    description: 'Premium directory listing (30 days featured)',
    type: PaymentType.ONE_TIME,
    priceInCents: 3900,
    currency: 'usd',
    cnyPriceInCents: 27900,
    credits: 0,
    kind: 'directory_submit',
    featuredDays: 30,
  },

  // Directory sponsor ads — monthly subscription (auto-renew until canceled).
  // Checkout: /api/directory/ads/$id/checkout. Renewal extends endsAt.
  directory_sponsor_silver: {
    productId: 'directory_sponsor_silver',
    productName: 'Directory Sponsor',
    planName: 'Silver',
    description: 'Silver sponsor placement (monthly)',
    type: PaymentType.SUBSCRIPTION,
    priceInCents: 4900,
    currency: 'usd',
    cnyPriceInCents: 34900,
    credits: 0,
    kind: 'directory_sponsor',
    featuredDays: 30,
    plan: {
      name: 'Silver',
      interval: PaymentInterval.MONTH,
      intervalCount: 1,
    },
  },
  directory_sponsor_gold: {
    productId: 'directory_sponsor_gold',
    productName: 'Directory Sponsor',
    planName: 'Gold',
    description: 'Gold sponsor placement (monthly)',
    type: PaymentType.SUBSCRIPTION,
    priceInCents: 14900,
    currency: 'usd',
    cnyPriceInCents: 99900,
    credits: 0,
    kind: 'directory_sponsor',
    featuredDays: 30,
    plan: {
      name: 'Gold',
      interval: PaymentInterval.MONTH,
      intervalCount: 1,
    },
  },
  directory_sponsor_platinum: {
    productId: 'directory_sponsor_platinum',
    productName: 'Directory Sponsor',
    planName: 'Platinum',
    description: 'Platinum sponsor placement (monthly)',
    type: PaymentType.SUBSCRIPTION,
    priceInCents: 29900,
    currency: 'usd',
    cnyPriceInCents: 199900,
    credits: 0,
    kind: 'directory_sponsor',
    featuredDays: 30,
    plan: {
      name: 'Platinum',
      interval: PaymentInterval.MONTH,
      intervalCount: 1,
    },
  },
};

export function getPricingProduct(productId: string): PricingProduct | null {
  if (!productId) return null;
  return pricingCatalog[productId] ?? null;
}

export function listPricingProducts(): PricingProduct[] {
  return Object.values(pricingCatalog);
}

/** Products that need provider ID mapping in admin payment settings. */
export function listProductMappingCatalog(): PricingProduct[] {
  return listPricingProducts().filter(
    (p) =>
      p.kind === 'guest_post' ||
      p.kind === 'directory_submit' ||
      p.kind === 'directory_sponsor'
  );
}

export function listGuestPostPackages(): PricingProduct[] {
  return listPricingProducts().filter((p) => p.kind === 'guest_post');
}

export function getDirectorySubmitProduct(
  plan: 'premium' | string
): PricingProduct | null {
  if (plan === 'premium') return getPricingProduct('directory_submit_premium');
  return null;
}

export function getDirectorySponsorProduct(
  tier: 'silver' | 'gold' | 'platinum' | string
): PricingProduct | null {
  return getPricingProduct(`directory_sponsor_${tier}`);
}
