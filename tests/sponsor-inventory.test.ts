import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { and, eq, inArray } from 'drizzle-orm';

const directory = await mkdtemp(join(tmpdir(), 'shipany-sponsor-test-'));
Object.assign(process.env, {
  DATABASE_PROVIDER: 'sqlite',
  DATABASE_URL: `file:${directory}/test.db`,
  AUTH_SECRET: 'isolated-sponsor-test-secret-not-a-real-credential',
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
const { directorySponsorAd, order, subscription, user } =
  await import('../src/config/db/schema');
const {
  SPONSOR_PENDING_PAYMENT_TTL_MS,
  cancelPendingSponsorAdPayment,
  countSponsorTierUsed,
  createSponsorAd,
  releaseStalePendingSponsorAds,
} = await import('../src/modules/directory/user-actions');
const { expireDirectoryAdForSubscription, renewDirectoryAdForSubscription } =
  await import('../src/modules/directory/payment');
const { handleSubscriptionRenewal } =
  await import('../src/modules/payment/service');
const { SPONSOR_TIERS } =
  await import('../src/lib/directory/submit-sponsor-config');

after(async () => {
  await rm(directory, { recursive: true, force: true });
});

const userId = 'sponsor-user-1';
const otherUserId = 'sponsor-user-2';
await db()
  .insert(user)
  .values({ id: userId, name: 'Sponsor', email: 'sponsor@example.test' });
await db().insert(user).values({
  id: otherUserId,
  name: 'Sponsor 2',
  email: 'sponsor2@example.test',
});

test('atomic create refuses oversell after filling the tier', async () => {
  const silverSpots =
    SPONSOR_TIERS.find((t) => t.tier === 'silver')?.spots ?? 12;
  // Fill with *other* users' active seats so this user hits sold_out
  // (not tier_already_held from stacking the same tier).
  const now = new Date();
  for (let i = 0; i < silverSpots; i++) {
    const fillerId = `sponsor-fill-${i}`;
    await db()
      .insert(user)
      .values({
        id: fillerId,
        name: `Filler ${i}`,
        email: `filler${i}@example.test`,
      });
    await db()
      .insert(directorySponsorAd)
      .values({
        id: `fill-silver-${i}`,
        userId: fillerId,
        name: `Filled ${i}`,
        tagline: 'taken',
        url: 'https://example.test',
        tier: 'silver',
        status: 'active',
        startsAt: now,
        endsAt: new Date(now.getTime() + 30 * 86400000),
        createdAt: now,
        updatedAt: now,
      });
  }
  await assert.rejects(
    () =>
      createSponsorAd({
        userId,
        name: 'Overflow',
        tagline: 'should fail',
        url: 'https://example.test/x',
        tier: 'silver',
      }),
    /sold_out/
  );
  assert.equal(await countSponsorTierUsed('silver'), silverSpots);
});

test('pending_payment older than TTL is released and no longer counts', async () => {
  const stale = new Date(Date.now() - SPONSOR_PENDING_PAYMENT_TTL_MS - 1000);
  await db().insert(directorySponsorAd).values({
    id: 'stale-pending-1',
    userId,
    name: 'Stale',
    tagline: 'abandoned checkout',
    url: 'https://example.test/stale',
    tier: 'gold',
    status: 'pending_payment',
    startsAt: null,
    endsAt: null,
    createdAt: stale,
    updatedAt: stale,
  });
  const before = await countSponsorTierUsed('gold');
  assert.ok(before >= 1);
  await releaseStalePendingSponsorAds('gold');
  const [row] = await db()
    .select({ status: directorySponsorAd.status })
    .from(directorySponsorAd)
    .where(eq(directorySponsorAd.id, 'stale-pending-1'));
  assert.equal(row.status, 'expired');
  const used = await countSponsorTierUsed('gold');
  assert.equal(
    used,
    (
      await db()
        .select()
        .from(directorySponsorAd)
        .where(
          and(
            eq(directorySponsorAd.tier, 'gold'),
            inArray(directorySponsorAd.status, ['active', 'pending_payment'])
          )
        )
    ).length
  );
});

test('renewal heal idempotently pushes endsAt to periodEnd', async () => {
  const now = new Date();
  const adId = 'renew-ad-1';
  const subNo = 'sub-sponsor-1';
  await db()
    .insert(directorySponsorAd)
    .values({
      id: adId,
      userId,
      name: 'Renew Me',
      tagline: 'monthly',
      url: 'https://example.test/renew',
      tier: 'platinum',
      status: 'active',
      startsAt: now,
      endsAt: new Date(now.getTime() + 5 * 86400000),
      createdAt: now,
      updatedAt: now,
    });
  await db()
    .insert(subscription)
    .values({
      id: 'sub-row-1',
      subscriptionNo: subNo,
      userId,
      userEmail: 'sponsor@example.test',
      status: 'active',
      paymentProvider: 'stripe',
      subscriptionId: 'sub_stripe_1',
      productId: 'directory_sponsor_platinum',
      amount: 29900,
      currency: 'usd',
      interval: 'month',
      intervalCount: 1,
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + 5 * 86400000),
      productName: 'Directory Sponsor',
      planName: 'Platinum',
    });
  await db()
    .insert(order)
    .values({
      id: 'ord-first-1',
      orderNo: 'ORD-FIRST-1',
      userId,
      userEmail: 'sponsor@example.test',
      status: 'paid',
      amount: 29900,
      currency: 'usd',
      productId: 'directory_sponsor_platinum',
      paymentType: 'subscription',
      paymentProvider: 'stripe',
      checkoutInfo: '{}',
      subscriptionNo: subNo,
      reference: `directory_ad:${adId}`,
      paidAt: now,
    });

  const periodEnd = new Date(now.getTime() + 35 * 86400000);
  await renewDirectoryAdForSubscription({
    subscriptionNo: subNo,
    productId: 'directory_sponsor_platinum',
    periodEnd,
  });
  const [after] = await db()
    .select()
    .from(directorySponsorAd)
    .where(eq(directorySponsorAd.id, adId));
  assert.equal(after.status, 'active');
  assert.equal(new Date(after.endsAt!).getTime(), periodEnd.getTime());

  // Second heal is a no-op overwrite to the same periodEnd.
  await renewDirectoryAdForSubscription({
    subscriptionNo: subNo,
    productId: 'directory_sponsor_platinum',
    periodEnd,
  });
  const [again] = await db()
    .select()
    .from(directorySponsorAd)
    .where(eq(directorySponsorAd.id, adId));
  assert.equal(new Date(again.endsAt!).getTime(), periodEnd.getTime());
});

test('renewal of one subscription does not extend a sibling seat', async () => {
  const now = new Date();
  const adA = 'renew-sibling-a';
  const adB = 'renew-sibling-b';
  const subA = 'sub-sibling-a';
  const subB = 'sub-sibling-b';
  const endA = new Date(now.getTime() + 10 * 86400000);
  const endB = new Date(now.getTime() + 12 * 86400000);

  for (const row of [
    { id: adA, name: 'A', endsAt: endA },
    { id: adB, name: 'B', endsAt: endB },
  ]) {
    await db()
      .insert(directorySponsorAd)
      .values({
        id: row.id,
        userId,
        name: row.name,
        tagline: 'multi',
        url: `https://example.test/${row.id}`,
        tier: 'gold',
        status: 'active',
        startsAt: now,
        endsAt: row.endsAt,
        createdAt: now,
        updatedAt: now,
      });
  }
  await db()
    .insert(subscription)
    .values([
      {
        id: 'sub-row-sibling-a',
        subscriptionNo: subA,
        userId,
        userEmail: 'sponsor@example.test',
        status: 'active',
        paymentProvider: 'stripe',
        subscriptionId: 'sub_stripe_sibling_a',
        productId: 'directory_sponsor_gold',
        amount: 14900,
        currency: 'usd',
        interval: 'month',
        intervalCount: 1,
        currentPeriodStart: now,
        currentPeriodEnd: endA,
        productName: 'Directory Sponsor',
        planName: 'Gold',
      },
      {
        id: 'sub-row-sibling-b',
        subscriptionNo: subB,
        userId,
        userEmail: 'sponsor@example.test',
        status: 'active',
        paymentProvider: 'stripe',
        subscriptionId: 'sub_stripe_sibling_b',
        productId: 'directory_sponsor_gold',
        amount: 14900,
        currency: 'usd',
        interval: 'month',
        intervalCount: 1,
        currentPeriodStart: now,
        currentPeriodEnd: endB,
        productName: 'Directory Sponsor',
        planName: 'Gold',
      },
    ]);
  await db()
    .insert(order)
    .values([
      {
        id: 'ord-sibling-a',
        orderNo: 'ORD-SIBLING-A',
        userId,
        userEmail: 'sponsor@example.test',
        status: 'paid',
        amount: 14900,
        currency: 'usd',
        productId: 'directory_sponsor_gold',
        paymentType: 'subscription',
        paymentProvider: 'stripe',
        checkoutInfo: '{}',
        subscriptionNo: subA,
        reference: `directory_ad:${adA}`,
        paidAt: now,
      },
      {
        id: 'ord-sibling-b',
        orderNo: 'ORD-SIBLING-B',
        userId,
        userEmail: 'sponsor@example.test',
        status: 'paid',
        amount: 14900,
        currency: 'usd',
        productId: 'directory_sponsor_gold',
        paymentType: 'subscription',
        paymentProvider: 'stripe',
        checkoutInfo: '{}',
        subscriptionNo: subB,
        reference: `directory_ad:${adB}`,
        paidAt: now,
      },
    ]);

  const newEndA = new Date(now.getTime() + 40 * 86400000);
  await renewDirectoryAdForSubscription({
    subscriptionNo: subA,
    productId: 'directory_sponsor_gold',
    periodEnd: newEndA,
  });

  const [a] = await db()
    .select()
    .from(directorySponsorAd)
    .where(eq(directorySponsorAd.id, adA));
  const [b] = await db()
    .select()
    .from(directorySponsorAd)
    .where(eq(directorySponsorAd.id, adB));
  assert.equal(new Date(a.endsAt!).getTime(), newEndA.getTime());
  assert.equal(new Date(b.endsAt!).getTime(), endB.getTime());
});

test('subscription renewal replay does not double-extend past one claim', async () => {
  const now = new Date();
  const adId = 'renew-ad-replay';
  const subNo = 'sub-sponsor-replay';
  const periodStart = new Date(now.getTime() - 86400000);
  const periodEnd = new Date(now.getTime() + 30 * 86400000);

  await db()
    .insert(directorySponsorAd)
    .values({
      id: adId,
      userId,
      name: 'Replay',
      tagline: 'monthly',
      url: 'https://example.test/replay',
      tier: 'platinum',
      status: 'active',
      startsAt: now,
      endsAt: new Date(now.getTime() + 86400000),
      createdAt: now,
      updatedAt: now,
    });
  await db()
    .insert(subscription)
    .values({
      id: 'sub-row-replay',
      subscriptionNo: subNo,
      userId,
      userEmail: 'sponsor@example.test',
      status: 'active',
      paymentProvider: 'stripe',
      subscriptionId: 'sub_stripe_replay',
      productId: 'directory_sponsor_platinum',
      amount: 29900,
      currency: 'usd',
      interval: 'month',
      intervalCount: 1,
      currentPeriodStart: periodStart,
      currentPeriodEnd: new Date(now.getTime() + 86400000),
      productName: 'Directory Sponsor',
      planName: 'Platinum',
    });
  await db()
    .insert(order)
    .values({
      id: 'ord-first-replay',
      orderNo: 'ORD-FIRST-REPLAY',
      userId,
      userEmail: 'sponsor@example.test',
      status: 'paid',
      amount: 29900,
      currency: 'usd',
      productId: 'directory_sponsor_platinum',
      paymentType: 'subscription',
      paymentProvider: 'stripe',
      checkoutInfo: '{}',
      subscriptionNo: subNo,
      reference: `directory_ad:${adId}`,
      paidAt: now,
    });

  const session = {
    subscriptionId: 'sub_stripe_replay',
    paymentStatus: 'paid',
    paymentInfo: {
      transactionId: 'txn_replay_1',
      paymentAmount: 29900,
      paymentCurrency: 'usd',
      paidAt: now,
    },
    paymentResult: {},
    subscriptionInfo: {
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
  };

  await handleSubscriptionRenewal(session, 'stripe');
  await handleSubscriptionRenewal(session, 'stripe'); // replay same txn

  const renewOrders = await db()
    .select()
    .from(order)
    .where(eq(order.transactionId, 'txn_replay_1'));
  assert.equal(renewOrders.length, 1);

  const [ad] = await db()
    .select()
    .from(directorySponsorAd)
    .where(eq(directorySponsorAd.id, adId));
  assert.equal(new Date(ad.endsAt!).getTime(), periodEnd.getTime());
});

test('cancel pending payment releases hold and cancels open orders', async () => {
  const now = new Date();
  const adId = 'cancel-pending-ad-1';
  const otherUser = 'sponsor-user-other';
  await db().insert(user).values({
    id: otherUser,
    name: 'Other',
    email: 'other-sponsor@example.test',
  });

  await db().insert(directorySponsorAd).values({
    id: adId,
    userId,
    name: 'Cancel Me',
    tagline: 'pending checkout',
    url: 'https://example.test/cancel',
    tier: 'gold',
    status: 'pending_payment',
    startsAt: null,
    endsAt: null,
    createdAt: now,
    updatedAt: now,
  });
  await db()
    .insert(order)
    .values([
      {
        id: 'ord-cancel-open-1',
        orderNo: 'ORD-CANCEL-OPEN-1',
        userId,
        userEmail: 'sponsor@example.test',
        status: 'created',
        amount: 14900,
        currency: 'usd',
        productId: 'directory_sponsor_gold',
        paymentType: 'subscription',
        paymentProvider: 'stripe',
        checkoutInfo: '{}',
        checkoutUrl: 'https://checkout.example/open-1',
        reference: `directory_ad:${adId}`,
      },
      {
        id: 'ord-cancel-open-2',
        orderNo: 'ORD-CANCEL-OPEN-2',
        userId,
        userEmail: 'sponsor@example.test',
        status: 'pending',
        amount: 14900,
        currency: 'usd',
        productId: 'directory_sponsor_gold',
        paymentType: 'subscription',
        paymentProvider: 'creem',
        checkoutInfo: '{}',
        checkoutUrl: 'https://checkout.example/open-2',
        reference: `directory_ad:${adId}`,
      },
    ]);

  const beforeUsed = await countSponsorTierUsed('gold');
  const result = await cancelPendingSponsorAdPayment({ userId, adId });
  assert.equal(result.status, 'expired');
  assert.equal(result.canceledOrders, 2);

  const [ad] = await db()
    .select()
    .from(directorySponsorAd)
    .where(eq(directorySponsorAd.id, adId));
  assert.equal(ad.status, 'expired');
  assert.equal(ad.startsAt, null);

  const openOrders = await db()
    .select()
    .from(order)
    .where(eq(order.reference, `directory_ad:${adId}`));
  assert.equal(openOrders.length, 2);
  assert.ok(
    openOrders.every(
      (o: { status: string; checkoutUrl: string | null }) =>
        o.status === 'canceled'
    )
  );
  assert.ok(
    openOrders.every(
      (o: { status: string; checkoutUrl: string | null }) =>
        o.checkoutUrl == null
    )
  );

  assert.equal(await countSponsorTierUsed('gold'), beforeUsed - 1);

  // Not pending anymore
  await assert.rejects(
    () => cancelPendingSponsorAdPayment({ userId, adId }),
    /not_pending/
  );

  // Other user's ad cannot be canceled by this user
  const foreignId = 'cancel-pending-foreign';
  await db().insert(directorySponsorAd).values({
    id: foreignId,
    userId: otherUser,
    name: 'Foreign',
    tagline: 'not yours',
    url: 'https://example.test/foreign',
    tier: 'gold',
    status: 'pending_payment',
    startsAt: null,
    endsAt: null,
    createdAt: now,
    updatedAt: now,
  });
  await assert.rejects(
    () => cancelPendingSponsorAdPayment({ userId, adId: foreignId }),
    /Ad not found/
  );
});

test('cancel pending payment refuses when a related order is already paid', async () => {
  const now = new Date();
  const adId = 'cancel-pending-paid-race';
  await db().insert(directorySponsorAd).values({
    id: adId,
    userId,
    name: 'Paid Race',
    tagline: 'still pending row',
    url: 'https://example.test/paid-race',
    tier: 'gold',
    status: 'pending_payment',
    startsAt: null,
    endsAt: null,
    createdAt: now,
    updatedAt: now,
  });
  await db()
    .insert(order)
    .values({
      id: 'ord-cancel-paid-1',
      orderNo: 'ORD-CANCEL-PAID-1',
      userId,
      userEmail: 'sponsor@example.test',
      status: 'paid',
      amount: 14900,
      currency: 'usd',
      productId: 'directory_sponsor_gold',
      paymentType: 'subscription',
      paymentProvider: 'stripe',
      checkoutInfo: '{}',
      reference: `directory_ad:${adId}`,
      paidAt: now,
    });
  await assert.rejects(
    () => cancelPendingSponsorAdPayment({ userId, adId }),
    /already_paid/
  );
  const [ad] = await db()
    .select()
    .from(directorySponsorAd)
    .where(eq(directorySponsorAd.id, adId));
  // Hold must remain so fulfillment / admin can finish activation.
  assert.equal(ad.status, 'pending_payment');
});

test('releaseStale expires active seats past endsAt and frees inventory', async () => {
  const now = new Date();
  const adId = 'past-ends-active-1';
  // Isolate: drop this user's live rows so counts are deterministic.
  await db()
    .delete(directorySponsorAd)
    .where(
      and(
        eq(directorySponsorAd.userId, userId),
        inArray(directorySponsorAd.status, ['active', 'pending_payment'])
      )
    );
  await db()
    .insert(directorySponsorAd)
    .values({
      id: adId,
      userId,
      name: 'Ended Seat',
      tagline: 'should free',
      url: 'https://example.test/ended',
      tier: 'platinum',
      status: 'active',
      startsAt: new Date(now.getTime() - 40 * 86400000),
      endsAt: new Date(now.getTime() - 1000),
      createdAt: now,
      updatedAt: now,
    });
  assert.equal(await countSponsorTierUsed('platinum'), 1);
  await releaseStalePendingSponsorAds('platinum');
  const [row] = await db()
    .select()
    .from(directorySponsorAd)
    .where(eq(directorySponsorAd.id, adId));
  assert.equal(row.status, 'expired');
  assert.equal(await countSponsorTierUsed('platinum'), 0);
  // Prior tests may leave a live platinum subscription; clear so rebook is about
  // inventory/ad status only (live-sub gate covered in a dedicated test).
  await db()
    .delete(subscription)
    .where(
      and(
        eq(subscription.userId, userId),
        eq(subscription.productId, 'directory_sponsor_platinum')
      )
    );
  const created = await createSponsorAd({
    userId,
    name: 'Rebook Platinum',
    tagline: 'after end',
    url: 'https://example.test/rebook-plat',
    tier: 'platinum',
  });
  assert.equal(created.status, 'pending_payment');
  await db()
    .delete(directorySponsorAd)
    .where(inArray(directorySponsorAd.id, [adId, created.id]));
});

test('createSponsorAd rejects when live subscription remains after ad soft-expire', async () => {
  const now = new Date();
  const adId = 'soft-expire-held-sub-1';
  const subNo = 'SUB-SOFT-EXPIRE-HELD-1';
  await db()
    .delete(directorySponsorAd)
    .where(
      and(
        eq(directorySponsorAd.userId, userId),
        inArray(directorySponsorAd.status, ['active', 'pending_payment'])
      )
    );
  await db()
    .insert(directorySponsorAd)
    .values({
      id: adId,
      userId,
      name: 'Soft Expired',
      tagline: 'ad gone sub live',
      url: 'https://example.test/soft-expired',
      tier: 'gold',
      status: 'expired',
      startsAt: new Date(now.getTime() - 40 * 86400000),
      endsAt: new Date(now.getTime() - 1000),
      createdAt: now,
      updatedAt: now,
    });
  await db()
    .insert(subscription)
    .values({
      id: 'sub-row-soft-expire-held',
      subscriptionNo: subNo,
      userId,
      userEmail: 'sponsor@example.test',
      status: 'pending_cancel',
      paymentProvider: 'stripe',
      subscriptionId: 'sub_stripe_soft_expire_held',
      productId: 'directory_sponsor_gold',
      amount: 14900,
      currency: 'usd',
      interval: 'month',
      intervalCount: 1,
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + 86400000),
      productName: 'Directory Sponsor',
      planName: 'Gold',
    });
  await assert.rejects(
    () =>
      createSponsorAd({
        userId,
        name: 'Rebook While Sub Live',
        tagline: 'blocked',
        url: 'https://example.test/rebook-while-sub',
        tier: 'gold',
      }),
    /tier_already_held/
  );
  await db().delete(subscription).where(eq(subscription.subscriptionNo, subNo));
  await db().delete(directorySponsorAd).where(eq(directorySponsorAd.id, adId));
});

test('createSponsorAd rejects second live seat on same tier', async () => {
  const now = new Date();
  const adId = 'tier-held-active-1';
  await db()
    .delete(directorySponsorAd)
    .where(
      and(
        eq(directorySponsorAd.userId, userId),
        inArray(directorySponsorAd.status, ['active', 'pending_payment'])
      )
    );
  await db()
    .insert(directorySponsorAd)
    .values({
      id: adId,
      userId,
      name: 'Live Gold',
      tagline: 'holding',
      url: 'https://example.test/live-gold',
      tier: 'gold',
      status: 'active',
      startsAt: now,
      endsAt: new Date(now.getTime() + 30 * 86400000),
      createdAt: now,
      updatedAt: now,
    });
  await assert.rejects(
    () =>
      createSponsorAd({
        userId,
        name: 'Another Gold',
        tagline: 'blocked',
        url: 'https://example.test/another-gold',
        tier: 'gold',
      }),
    /tier_already_held/
  );
  await db().delete(directorySponsorAd).where(eq(directorySponsorAd.id, adId));
});

test('expireDirectoryAdForSubscription marks the linked ad expired', async () => {
  const now = new Date();
  const adId = 'expire-via-sub-ad-1';
  const subNo = 'SUB-EXPIRE-AD-1';
  await db()
    .insert(directorySponsorAd)
    .values({
      id: adId,
      userId,
      name: 'Sub Linked',
      tagline: 'expire me',
      url: 'https://example.test/sub-linked',
      tier: 'silver',
      status: 'active',
      startsAt: now,
      endsAt: new Date(now.getTime() + 30 * 86400000),
      createdAt: now,
      updatedAt: now,
    });
  await db()
    .insert(order)
    .values({
      id: 'ord-expire-sub-1',
      orderNo: 'ORD-EXPIRE-SUB-1',
      userId,
      userEmail: 'sponsor@example.test',
      status: 'paid',
      amount: 4900,
      currency: 'usd',
      productId: 'directory_sponsor_silver',
      paymentType: 'subscription',
      paymentProvider: 'stripe',
      subscriptionNo: subNo,
      checkoutInfo: '{}',
      reference: `directory_ad:${adId}`,
      paidAt: now,
    });
  await expireDirectoryAdForSubscription(subNo);
  const [row] = await db()
    .select()
    .from(directorySponsorAd)
    .where(eq(directorySponsorAd.id, adId));
  assert.equal(row.status, 'expired');
  await db().delete(order).where(eq(order.id, 'ord-expire-sub-1'));
  await db().delete(directorySponsorAd).where(eq(directorySponsorAd.id, adId));
});
