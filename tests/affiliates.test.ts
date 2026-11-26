import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { and, eq } from 'drizzle-orm';

// Isolated SQLite database; no application modules load before the env is set.
const directory = await mkdtemp(join(tmpdir(), 'shipany-affiliates-test-'));
Object.assign(process.env, {
  DATABASE_PROVIDER: 'sqlite',
  DATABASE_URL: `file:${directory}/test.db`,
  AUTH_SECRET: 'isolated-affiliates-test-secret-not-a-real-credential',
  NODE_ENV: 'test',
  VITE_APP_URL: 'http://localhost:3000',
});
execFileSync(
  process.execPath,
  [
    'node_modules/drizzle-kit/bin.cjs',
    'push',
    '--dialect=sqlite',
    '--schema=./src/config/db/schema.sqlite.ts',
    `--url=${process.env.DATABASE_URL}`,
    '--force',
  ],
  { stdio: 'pipe', env: process.env }
);

const { db } = await import('../src/core/db');
const schema = await import('../src/config/db/schema');
const { settleCheckoutOrder, handleSubscriptionRenewal, refundOrder } =
  await import('../src/modules/payment/service');
const { saveConfigs } = await import('../src/modules/config/service');
const affiliates = await import('../src/modules/affiliates/service');
const { atomic } = await import('../src/core/db/atomic');

const { affiliateInvite, affiliateReward, affiliateWithdraw, order, user } =
  schema;

after(async () => {
  await rm(directory, { recursive: true, force: true });
});

// aff: an approved affiliate. pending: an affiliate still under review.
before(async () => {
  await db()
    .insert(user)
    .values(
      ['aff', 'pending'].map((id) => ({
        id,
        name: id,
        email: `${id}@example.test`,
      }))
    );
  await affiliates.applyAffiliate({
    userId: 'aff',
    userEmail: 'aff@example.test',
    reason: 'blog',
    autoApprove: true,
  });
  await affiliates.applyAffiliate({
    userId: 'pending',
    userEmail: 'pending@example.test',
    reason: 'blog',
  });
  await setRule({});
});

/** Admin settings → reward rule. Unset keys fall back to the defaults. */
async function setRule(values: Record<string, string>) {
  await saveConfigs({
    affiliates_enabled: 'true',
    affiliate_reward_percent: '',
    affiliate_reward_scope: '',
    affiliate_reward_payments: '',
    affiliate_min_withdraw_usd: '',
    affiliate_min_withdraw_cny: '',
    // No hold unless a test sets one, so balances move at once.
    affiliate_hold_days: '0',
    ...values,
  });
}

let buyers = 0;
/** A new user (each buyer's first payment is the only one that earns). */
async function newBuyer() {
  const id = `buyer${++buyers}`;
  await db()
    .insert(user)
    .values({ id, name: id, email: `${id}@example.test` });
  return id;
}

async function invite(buyer: string) {
  const [link] = await affiliates.listInviteCodes({ userId: 'aff' });
  await affiliates.handleInviteNewUser({
    newUserId: buyer,
    inviteCode: link.code,
  });
}

let seq = 0;
/** Create an order and settle it as paid; returns its orderNo. */
async function pay(
  userId: string,
  values: Partial<typeof order.$inferInsert> = {},
  paymentInfo: Record<string, unknown> = {}
) {
  const orderNo = `ORD-${++seq}`;
  await db()
    .insert(order)
    .values({
      id: orderNo,
      orderNo,
      userId,
      status: 'created',
      amount: 9000,
      currency: 'usd',
      paymentType: 'one-time',
      paymentProvider: 'stripe',
      paymentSessionId: `cs_${orderNo}`,
      checkoutInfo: '{}',
      ...values,
    });
  const [row] = await db()
    .select()
    .from(order)
    .where(eq(order.orderNo, orderNo));
  const session = {
    paymentStatus: 'paid',
    paymentResult: { id: row.paymentSessionId },
    paymentInfo: {
      paidAt: new Date(),
      paymentAmount: row.amount,
      paymentCurrency: row.currency,
      ...paymentInfo,
    },
  };
  // Webhook + callback racing: settles once.
  await settleCheckoutOrder(row, session, 'stripe');
  await settleCheckoutOrder(row, session, 'stripe');
  return orderNo;
}

async function rewardOf(orderNo: string) {
  const rows = await db()
    .select()
    .from(affiliateReward)
    .where(eq(affiliateReward.orderNo, orderNo));
  assert.ok(rows.length <= 1, 'at most one reward per order');
  return rows[0];
}

async function cashBalance() {
  const detail = await affiliates.getRewardDetail({ userId: 'aff' });
  return detail.rewardBalances.find((b) => b.currency === 'USD')?.amount ?? 0;
}

async function refund(orderNo: string) {
  const [row] = await db()
    .select({ paymentAmount: order.paymentAmount })
    .from(order)
    .where(eq(order.orderNo, orderNo));
  // Nothing to refund at the provider in tests; restore the charge after.
  await db()
    .update(order)
    .set({ paymentAmount: 0 })
    .where(eq(order.orderNo, orderNo));
  await refundOrder({ orderNo, operatorId: 'admin' });
  await db()
    .update(order)
    .set({ paymentAmount: row.paymentAmount })
    .where(eq(order.orderNo, orderNo));
}

test('rule: 20% by default, at most 50%, invalid values fall back', async () => {
  const { getAffiliateRewardRule } = await import('../src/config/affiliates');
  const percent = (value?: string) =>
    getAffiliateRewardRule({ affiliate_reward_percent: value }).percent;
  assert.equal(percent(), 20);
  assert.equal(percent('35'), 35);
  assert.equal(percent('80'), 50, 'capped at 50');
  assert.equal(percent('abc'), 20);
});

test('an invited buyer’s first payment earns 20%: $1000 → $200', async () => {
  const buyer = await newBuyer();
  await invite(buyer);
  const orderNo = await pay(buyer, { amount: 100000 });
  const reward = await rewardOf(orderNo);
  assert.equal(reward.userId, 'aff');
  assert.equal(reward.rewardType, 'cash');
  assert.equal(reward.rewardPercent, 20);
  assert.equal(reward.rewardAmount, 20000);
  assert.equal(reward.rewardScene, 'first_payment');
});

test('buyers nobody invited earn nothing', async () => {
  const buyer = await newBuyer();
  const orderNo = await pay(buyer, { discountCode: 'STRIPE_PROMO' });
  assert.equal(await rewardOf(orderNo), undefined);
});

test('first payment only: later payments earn nothing', async () => {
  const buyer = await newBuyer();
  await invite(buyer);
  assert.ok(await rewardOf(await pay(buyer, { amount: 10000 })));
  assert.equal(await rewardOf(await pay(buyer)), undefined);

  // A refunded first payment still counts: refund-and-rebuy can't reset it.
  const other = await newBuyer();
  await invite(other);
  const first = await pay(other, { amount: 10000 });
  await refund(first);
  assert.equal(await rewardOf(await pay(other)), undefined);

  // The affiliate can't invite themselves, so their own purchase earns nothing.
  assert.equal(await rewardOf(await pay('aff')), undefined);
});

test('a subscription’s first payment earns; a provider coupon is fine', async () => {
  const buyer = await newBuyer();
  await invite(buyer);
  // List price 1000, charged 800 after a Stripe promotion code: the
  // commission is 20% of the charge, not of the list price.
  const orderNo = await pay(
    buyer,
    { amount: 1000, paymentType: 'subscription' },
    {
      paymentAmount: 800,
      paymentCurrency: 'usd',
      discountCode: 'STRIPE_PROMO',
      discountAmount: 200,
    }
  );
  assert.equal((await rewardOf(orderNo))?.rewardAmount, 160);

  // A 100% promotion code charges nothing, so it earns nothing.
  const free = await newBuyer();
  await invite(free);
  const freeOrder = await pay(
    free,
    { amount: 1000 },
    { paymentAmount: 0, paymentCurrency: 'usd' }
  );
  assert.equal(await rewardOf(freeOrder), undefined);
});

const DAY = 86_400_000;

/**
 * A $10/month subscription through the real settlement path. The checkout
 * charges `firstCharge` (0 = a free trial); `renew()` settles the next
 * period's $10 charge.
 */
async function subscribe(buyer: string, firstCharge: number) {
  const start = new Date('2026-10-01T00:00:00Z');
  const orderNo = `ORD-${++seq}`;
  await db()
    .insert(order)
    .values({
      id: orderNo,
      orderNo,
      userId: buyer,
      status: 'created',
      amount: 1000,
      currency: 'usd',
      paymentType: 'subscription',
      paymentProvider: 'stripe',
      paymentSessionId: `cs_${orderNo}`,
      checkoutInfo: '{}',
    });
  const [row] = await db()
    .select()
    .from(order)
    .where(eq(order.orderNo, orderNo));
  let periodStart = new Date(start.getTime() + 7 * DAY);
  await settleCheckoutOrder(
    row,
    {
      paymentStatus: 'paid',
      paymentResult: { id: row.paymentSessionId },
      paymentInfo: {
        paidAt: start,
        paymentAmount: firstCharge,
        paymentCurrency: 'usd',
      },
      subscriptionId: `sub_${orderNo}`,
      subscriptionResult: {},
      subscriptionInfo: {
        status: firstCharge > 0 ? 'active' : 'trialing',
        amount: 1000,
        currency: 'usd',
        interval: 'month',
        intervalCount: 1,
        currentPeriodStart: start,
        currentPeriodEnd: periodStart,
      },
    },
    'stripe'
  );
  let n = 0;
  return {
    orderNo,
    async renew() {
      const transactionId = `pi_${orderNo}_${++n}`;
      const session = {
        paymentStatus: 'paid',
        paymentResult: { id: transactionId },
        paymentInfo: {
          transactionId,
          paidAt: periodStart,
          paymentAmount: 1000,
          paymentCurrency: 'usd',
        },
        subscriptionId: `sub_${orderNo}`,
        subscriptionInfo: {
          currentPeriodStart: periodStart,
          currentPeriodEnd: new Date(periodStart.getTime() + 30 * DAY),
        },
      };
      // Duplicate delivery: settles once.
      await handleSubscriptionRenewal(session, 'stripe');
      await handleSubscriptionRenewal(session, 'stripe');
      periodStart = session.subscriptionInfo.currentPeriodEnd;
    },
  };
}

/** The buyer's rewards, oldest order first. */
async function rewardsOfBuyer(buyer: string) {
  const rows = await db()
    .select()
    .from(affiliateReward)
    .innerJoin(order, eq(order.orderNo, affiliateReward.orderNo))
    .where(eq(order.userId, buyer));
  return rows
    .map((r: any) => r.affiliate_reward)
    .sort((a: any, b: any) => +a.createdAt - +b.createdAt);
}

test('a free trial earns on its first real charge (a renewal), once', async () => {
  const buyer = await newBuyer();
  await invite(buyer);
  const sub = await subscribe(buyer, 0);
  // Trial start: the checkout charges $0, nothing earned.
  assert.equal(await rewardOf(sub.orderNo), undefined);

  // The first real charge after the trial earns 20%.
  await sub.renew();
  let rewards = await rewardsOfBuyer(buyer);
  assert.equal(rewards.length, 1);
  assert.equal(rewards[0].rewardAmount, 200);

  // The next renewal earns nothing.
  await sub.renew();
  rewards = await rewardsOfBuyer(buyer);
  assert.equal(rewards.length, 1);
});

test('rule: payments that earn — first (default), first N, every one', async () => {
  const { getAffiliateRewardRule, rewardPaymentLimit } =
    await import('../src/config/affiliates');
  const rule = (c: Record<string, string>) => getAffiliateRewardRule(c);
  assert.equal(rule({}).scope, 'first');
  assert.equal(rewardPaymentLimit(rule({})), 1);
  assert.equal(rule({ affiliate_reward_scope: 'bogus' }).scope, 'first');
  assert.equal(
    rewardPaymentLimit(rule({ affiliate_reward_scope: 'first_n' })),
    3,
    'N defaults to 3'
  );
  assert.equal(
    rewardPaymentLimit(
      rule({
        affiliate_reward_scope: 'first_n',
        affiliate_reward_payments: '5',
      })
    ),
    5
  );
  assert.equal(
    rule({ affiliate_reward_payments: '0' }).payments,
    1,
    'at least 1'
  );
  assert.equal(
    rule({ affiliate_reward_payments: '999' }).payments,
    120,
    'at most 120'
  );
  assert.equal(
    rewardPaymentLimit(rule({ affiliate_reward_scope: 'all' })),
    null
  );
});

test('first N payments: renewals count, a trial’s $0 start doesn’t, refunds do', async () => {
  await setRule({
    affiliate_reward_scope: 'first_n',
    affiliate_reward_payments: '3',
  });
  try {
    // Trial ($0) + 4 renewals: renewals 1–3 earn, the 4th doesn't.
    const buyer = await newBuyer();
    await invite(buyer);
    const sub = await subscribe(buyer, 0);
    for (let i = 0; i < 4; i++) await sub.renew();
    const rewards = await rewardsOfBuyer(buyer);
    assert.deepEqual(
      rewards.map((r: any) => r.rewardAmount),
      [200, 200, 200]
    );

    // One-time purchases count the same way; a refunded one still uses a slot.
    const other = await newBuyer();
    await invite(other);
    const first = await pay(other, { amount: 1000 });
    assert.equal((await rewardOf(first))?.rewardAmount, 200);
    await refund(first);
    assert.equal((await rewardOf(first))?.status, 'revoked');
    assert.ok(await rewardOf(await pay(other, { amount: 1000 })));
    assert.ok(await rewardOf(await pay(other, { amount: 1000 })));
    assert.equal(await rewardOf(await pay(other, { amount: 1000 })), undefined);
  } finally {
    await setRule({});
  }
});

test('every payment: checkout and each renewal earn', async () => {
  await setRule({ affiliate_reward_scope: 'all' });
  try {
    const buyer = await newBuyer();
    await invite(buyer);
    const sub = await subscribe(buyer, 1000);
    for (let i = 0; i < 3; i++) await sub.renew();
    const rewards = await rewardsOfBuyer(buyer);
    assert.equal(rewards.length, 4);
    assert.ok(rewards.every((r: any) => r.rewardAmount === 200));
    // Each reward is keyed by its own order.
    assert.equal(new Set(rewards.map((r: any) => r.orderNo)).size, 4);
  } finally {
    await setRule({});
  }
});

test('master switch off: payments earn nothing', async () => {
  await setRule({ affiliates_enabled: 'false' });
  const buyer = await newBuyer();
  await invite(buyer);
  const orderNo = await pay(buyer);
  assert.equal(await rewardOf(orderNo), undefined);
  await setRule({});
});

test('invites: recorded once, never self', async () => {
  const [link] = await affiliates.listInviteCodes({ userId: 'aff' });
  assert.ok(link?.isDefault, 'approval creates a default invite link');
  const before = await affiliates.getInvitesCount({ userId: 'aff' });
  await affiliates.handleInviteNewUser({
    newUserId: 'aff',
    inviteCode: link.code,
  });
  assert.equal(await affiliates.getInvitesCount({ userId: 'aff' }), before);
  const buyer = await newBuyer();
  await invite(buyer);
  await invite(buyer);
  assert.equal(await affiliates.getInvitesCount({ userId: 'aff' }), before + 1);
});

test('renewals earn nothing', async () => {
  const buyer = await newBuyer();
  await invite(buyer);
  const start = await pay(buyer, { paymentType: 'subscription' });
  assert.ok(await rewardOf(start));
  const renewal = await affiliates.planAffiliateReward({
    userId: buyer,
    orderNo: 'SUB-1-renewal',
    amount: 2900,
    currency: 'usd',
  });
  assert.equal(renewal, null);
  await refund(start); // keep later balances unchanged
});

test('a refund revokes the reward and lowers the balance', async () => {
  const before = await cashBalance();
  const buyer = await newBuyer();
  await invite(buyer);
  const orderNo = await pay(buyer, { amount: 10000 });
  assert.equal(await cashBalance(), before + 2000);
  await refund(orderNo);
  assert.equal((await rewardOf(orderNo))?.status, 'revoked');
  assert.equal(await cashBalance(), before);
});

test('an affiliate’s own percent (at most 50) overrides the setting', async () => {
  const affiliate = await affiliates.findAffiliateUserByUserId('aff');
  const tooHigh = await affiliates.updateAffiliateUser(affiliate!.id, {
    commissionPercent: 51,
  });
  assert.equal(tooHigh.error, 'invalid_percent');
  await affiliates.updateAffiliateUser(affiliate!.id, {
    commissionPercent: 50,
  });
  const buyer = await newBuyer();
  await invite(buyer);
  const orderNo = await pay(buyer, { amount: 10000 });
  assert.equal((await rewardOf(orderNo))?.rewardAmount, 5000);
  await affiliates.updateAffiliateUser(affiliate!.id, {
    commissionPercent: 0,
  });
});

test('withdrawals: one pending at a time, never above the balance', async () => {
  const balance = await cashBalance();
  assert.ok(balance >= 5000, `balance ${balance} reaches the $50 minimum`);

  const results = await Promise.all([
    affiliates.createWithdraw({ userId: 'aff', description: 'paypal' }),
    affiliates.createWithdraw({ userId: 'aff', description: 'paypal' }),
  ]);
  assert.equal(results.filter((r) => r.ok).length, 1);
  const pending = await db()
    .select()
    .from(affiliateWithdraw)
    .where(eq(affiliateWithdraw.userId, 'aff'));
  assert.equal(pending.length, 1);
  assert.equal(pending[0].amount, balance);
  assert.equal(pending[0].currency, 'USD');
  assert.equal(await cashBalance(), 0, 'pending reserves the balance');
  const again = await affiliates.createWithdraw({
    userId: 'aff',
    description: 'x',
  });
  assert.equal(again.error, 'pending_exists');

  assert.deepEqual(
    await affiliates.updateAffiliateWithdraw(pending[0].id, {
      status: 'rejected',
      remark: 'wrong account',
    }),
    { ok: true }
  );
  const flip = await affiliates.updateAffiliateWithdraw(pending[0].id, {
    status: 'success',
  });
  assert.equal(flip.error, 'already_processed');
  assert.equal(await cashBalance(), balance, 'rejected returns the balance');
});

test('hold period: cash waits before it can be withdrawn; refunds revoke it first', async () => {
  const held = { affiliate_hold_days: '30' };
  await setRule(held);
  const before = await cashBalance();
  const firstBuyer = await newBuyer();
  await invite(firstBuyer);
  const refunded = await pay(firstBuyer, { amount: 10000 });
  const reward = await rewardOf(refunded);
  const days = (reward.availableAt!.getTime() - Date.now()) / 86_400_000;
  assert.ok(days > 29.9 && days <= 30, 'available 30 days after payment');

  let detail = await affiliates.getRewardDetail({ userId: 'aff' });
  assert.equal(await cashBalance(), before, 'held: not withdrawable yet');
  assert.deepEqual(detail.pendingBalances, [{ currency: 'USD', amount: 2000 }]);
  assert.equal(detail.nextAvailableAt, reward.availableAt!.toISOString());

  // A refund inside the hold revokes it before any payout.
  await refund(refunded);
  detail = await affiliates.getRewardDetail({ userId: 'aff' });
  assert.deepEqual(detail.pendingBalances, []);

  // Past its hold, a reward joins the balance.
  const keptBuyer = await newBuyer();
  await invite(keptBuyer);
  const kept = await pay(keptBuyer, { amount: 10000 });
  await db()
    .update(affiliateReward)
    .set({ availableAt: new Date(Date.now() - 1000) })
    .where(eq(affiliateReward.orderNo, kept));
  assert.equal(await cashBalance(), before + 2000);

  // The minimum is an admin setting too.
  await setRule({ ...held, affiliate_min_withdraw_usd: '100000' });
  detail = await affiliates.getRewardDetail({ userId: 'aff' });
  assert.deepEqual(
    detail.minWithdraw.find((x) => x.currency === 'USD'),
    { currency: 'USD', amount: 10_000_000 }
  );
  const tooSmall = await affiliates.createWithdraw({
    userId: 'aff',
    description: 'paypal',
  });
  assert.equal(tooSmall.error, 'no_balance');

  // Held rewards are never withdrawn, even with no minimum.
  await setRule({ ...held, affiliate_min_withdraw_usd: '0' });
  const heldBuyer = await newBuyer();
  await invite(heldBuyer);
  const heldOrder = await pay(heldBuyer, { amount: 10000 });
  assert.ok((await rewardOf(heldOrder)).availableAt);
  assert.deepEqual(
    await affiliates.createWithdraw({ userId: 'aff', description: 'paypal' }),
    { ok: true }
  );
  const [payout] = await db()
    .select()
    .from(affiliateWithdraw)
    .where(
      and(
        eq(affiliateWithdraw.userId, 'aff'),
        eq(affiliateWithdraw.status, 'pending')
      )
    );
  assert.equal(payout.amount, before + 2000, 'held 2000 stays behind');
  await affiliates.updateAffiliateWithdraw(payout.id, { status: 'rejected' });
  await refund(heldOrder);
  await setRule({});
});

test('a manual reward shares the order’s key: one per order', async () => {
  await setRule({ affiliate_reward_percent: '0' }); // nothing automatic
  const buyer = await newBuyer();
  await invite(buyer);
  const orderNo = await pay(buyer, { amount: 5000 });
  assert.equal(await rewardOf(orderNo), undefined);
  await setRule({});
  const [row] = await db()
    .select()
    .from(affiliateInvite)
    .where(eq(affiliateInvite.inviteUserId, buyer));

  const grant = (
    data: Parameters<typeof affiliates.createRewardForInvite>[1]
  ) => affiliates.createRewardForInvite(row.id, data);
  assert.equal(
    (await grant({ rewardType: 'fixed', amount: 6000 })).error,
    'invalid_amount'
  );
  assert.deepEqual(await grant({ rewardType: 'percent', percent: 10 }), {
    ok: true,
  });
  assert.equal(
    (await grant({ rewardType: 'percent', percent: 10 })).error,
    'reward_exists'
  );
  const reward = await rewardOf(orderNo);
  assert.equal(reward?.rewardAmount, 500);
  assert.equal(reward?.rewardType, 'manual');
});

test('statistics rank affiliates in one currency', async () => {
  const active = await db()
    .select()
    .from(affiliateReward)
    .where(
      and(
        eq(affiliateReward.userId, 'aff'),
        eq(affiliateReward.status, 'active')
      )
    );
  const { items } = await affiliates.listAffiliateStatisticsAdmin({
    currency: 'USD',
    sortBy: 'rewardAmount',
  });
  const row = items.find((item) => item.userId === 'aff');
  assert.ok(row);
  assert.equal(
    row.rewardAmount,
    active.reduce(
      (total: number, r: { rewardAmount: number }) => total + r.rewardAmount,
      0
    )
  );
});

test('invite link parameter: admin setting, default ref, validated', async () => {
  const { getAffiliateRewardRule } = await import('../src/config/affiliates');
  const param = (value?: string) =>
    getAffiliateRewardRule({ affiliate_invite_param: value }).inviteParam;
  assert.equal(param(), 'ref');
  assert.equal(param(' via '), 'via');
  assert.equal(param('invite_code'), 'invite_code');
  for (const bad of ['', '1ref', 'utm_source', 'a b', 'x'.repeat(33), 'r&f'])
    assert.equal(param(bad), 'ref', bad);
});

test('invite codes may not contain reserved words', async () => {
  await saveConfigs({ affiliate_reserved_codes: 'ShipAny\n\n official \n' });
  const create = (inviteCode: string) =>
    affiliates.createInviteCode({
      userId: 'aff',
      inviteCode,
    });
  assert.equal((await create('shipany')).error, 'reserved_code');
  assert.equal((await create('Ship-Any2025')).error, 'reserved_code');
  assert.equal((await create('my_official_link')).error, 'reserved_code');
  assert.deepEqual(await create('friends-2025'), { ok: true });
  const [row] = (await affiliates.listInviteCodes({ userId: 'aff' })).filter(
    (r) => r.code === 'friends-2025'
  );
  const renamed = await affiliates.updateInviteCode({
    userId: 'aff',
    id: row.id,
    inviteCode: 'shipany-vip',
  });
  assert.equal(renamed.error, 'reserved_code');
  await saveConfigs({ affiliate_reserved_codes: '' });
});
