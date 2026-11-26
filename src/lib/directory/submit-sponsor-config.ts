export interface SubmitTier {
  id: string;
  nameKey: string;
  price: string;
  priceInCents: number;
  featuredDays: number;
  featureKeys: string[];
  recommended?: boolean;
}

export const SUBMIT_TIERS: SubmitTier[] = [
  {
    id: 'free',
    nameKey: 'dir.submit.plan_standard',
    price: 'Free',
    priceInCents: 0,
    featuredDays: 0,
    featureKeys: ['dir.submit.plan_free_f1', 'dir.submit.plan_free_f2'],
  },
  {
    id: 'premium',
    nameKey: 'dir.submit.plan_premium',
    price: '$39',
    priceInCents: 3900,
    featuredDays: 30,
    featureKeys: [
      'dir.submit.plan_premium_f1',
      'dir.submit.plan_premium_f2',
      'dir.submit.plan_premium_f3',
    ],
    recommended: true,
  },
];

export const SUBMIT_STEP_KEYS = [
  'dir.submit.step_1',
  'dir.submit.step_2',
  'dir.submit.step_3',
];

export const SUBMIT_FAQ_ITEMS = [
  {
    questionKey: 'dir.submit.faq_q1',
    answerKey: 'dir.submit.faq_a1',
  },
  {
    questionKey: 'dir.submit.faq_q2',
    answerKey: 'dir.submit.faq_a2',
    params: { price: '$39', days: 30 },
  },
  {
    questionKey: 'dir.submit.faq_q3',
    answerKey: 'dir.submit.faq_a3',
  },
  {
    questionKey: 'dir.submit.faq_q4',
    answerKey: 'dir.submit.faq_a4',
  },
  {
    questionKey: 'dir.submit.faq_q5',
    answerKey: 'dir.submit.faq_a5',
  },
  {
    questionKey: 'dir.submit.faq_q6',
    answerKey: 'dir.submit.faq_a6',
  },
  {
    questionKey: 'dir.submit.faq_q7',
    answerKey: 'dir.submit.faq_a7',
    params: { max: 10 },
  },
];

export interface SponsorTier {
  tier: 'silver' | 'gold' | 'platinum';
  nameKey: string;
  price: string;
  priceInCents: number;
  spots: number;
  left: number;
  featureKeys: string[];
}

export const SPONSOR_TIERS: SponsorTier[] = [
  {
    tier: 'silver',
    nameKey: 'dir.sponsor.tier_silver',
    price: '$49',
    priceInCents: 4900,
    spots: 12,
    left: 12,
    featureKeys: ['dir.sponsor.silver_f1', 'dir.sponsor.silver_f2'],
  },
  {
    tier: 'gold',
    nameKey: 'dir.sponsor.tier_gold',
    price: '$149',
    priceInCents: 14900,
    spots: 8,
    left: 8,
    featureKeys: ['dir.sponsor.gold_f1', 'dir.sponsor.gold_f2'],
  },
  {
    tier: 'platinum',
    nameKey: 'dir.sponsor.tier_platinum',
    price: '$299',
    priceInCents: 29900,
    spots: 4,
    left: 4,
    featureKeys: [
      'dir.sponsor.platinum_f1',
      'dir.sponsor.platinum_f2',
      'dir.sponsor.platinum_f3',
    ],
  },
];

export const ADVERTISE_STEP_KEYS = [
  'dir.sponsor.step_1',
  'dir.sponsor.step_2',
  'dir.sponsor.step_3',
];

export const ADVERTISE_FAQ_ITEMS = [
  {
    questionKey: 'dir.sponsor.faq_q1',
    answerKey: 'dir.sponsor.faq_a1',
  },
  {
    questionKey: 'dir.sponsor.faq_q2',
    answerKey: 'dir.sponsor.faq_a2',
  },
  {
    questionKey: 'dir.sponsor.faq_q3',
    answerKey: 'dir.sponsor.faq_a3',
  },
  {
    questionKey: 'dir.sponsor.faq_q4',
    answerKey: 'dir.sponsor.faq_a4',
  },
];

/** Abandoned checkout holds older than this no longer occupy inventory. */
export const SPONSOR_PENDING_PAYMENT_TTL_MS = 60 * 60 * 1000; // 60 minutes
