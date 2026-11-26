/**
 * /submit + /advertise form → checkout → settlement success/failure.
 * Exercises the same user-actions + payment.settle path the UI hits after
 * submitDirectoryToolFn / createSponsorAdFn + checkout APIs.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { eq } from 'drizzle-orm';

const directory = await mkdtemp(join(tmpdir(), 'shipany-dir-submit-ad-'));
Object.assign(process.env, {
  DATABASE_PROVIDER: 'sqlite',
  DATABASE_URL: `file:${directory}/test.db`,
  AUTH_SECRET: 'isolated-dir-submit-ad-test-secret-not-a-real-credential',
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
const {
  directoryCategory,
  directorySponsorAd,
  directoryTool,
  directoryToolTranslation,
  order,
  user,
} = await import('../src/config/db/schema');
const { createSponsorAd, submitDirectoryTool } =
  await import('../src/modules/directory/user-actions');
const {
  directoryAdOrderReference,
  directoryToolOrderReference,
  getPayableDirectoryAd,
  getPayableDirectoryTool,
} = await import('../src/modules/directory/payment');
const { settleCheckoutOrder } = await import('../src/modules/payment/service');
const { SUBMIT_TIERS, SPONSOR_TIERS } =
  await import('../src/lib/directory/submit-sponsor-config');

after(async () => {
  await rm(directory, { recursive: true, force: true });
});

const author = 'dir-author-1';
const other = 'dir-other-1';
const categoryId = 'cat-coding-1';

await db()
  .insert(user)
  .values([
    { id: author, name: 'Author', email: 'author@example.test' },
    { id: other, name: 'Other', email: 'other@example.test' },
  ]);
await db().insert(directoryCategory).values({
  id: categoryId,
  slug: 'coding',
  icon: 'code',
  sort: 70,
  status: 'published',
});

function formPremium(
  overrides: Partial<Parameters<typeof submitDirectoryTool>[0]> = {}
) {
  return {
    userId: author,
    name: 'Test Tool',
    websiteUrl: 'https://example.test/tool',
    tagline: 'A solid tagline for the form',
    categoryId,
    description: 'Longer description from the form',
    plan: 'premium' as const,
    locale: 'en',
    ...overrides,
  };
}

function formAd(
  overrides: Partial<Parameters<typeof createSponsorAd>[0]> = {}
) {
  return {
    userId: author,
    name: 'Acme AI',
    tagline: 'Ship faster with Acme',
    url: 'https://example.test/acme',
    tier: 'gold' as const,
    ...overrides,
  };
}

async function toolCheckoutOrder(toolId: string, orderNo: string) {
  const pkgAmount =
    SUBMIT_TIERS.find((t) => t.id === 'premium')?.priceInCents ?? 3900;
  await db()
    .insert(order)
    .values({
      id: orderNo,
      orderNo,
      userId: author,
      userEmail: 'author@example.test',
      status: 'created',
      amount: pkgAmount,
      currency: 'usd',
      productId: 'directory_submit_premium',
      paymentType: 'one-time',
      paymentProvider: 'stripe',
      paymentSessionId: `cs_${orderNo}`,
      checkoutInfo: '{}',
      checkoutUrl: `https://pay.example/checkout/${orderNo}`,
      reference: directoryToolOrderReference(toolId),
    });
  const [row] = await db()
    .select()
    .from(order)
    .where(eq(order.orderNo, orderNo));
  return row;
}

async function ensureUser(id: string) {
  const [existing] = await db().select().from(user).where(eq(user.id, id));
  if (existing) return;
  await db()
    .insert(user)
    .values({ id, name: id, email: `${id}@example.test` });
}

async function adCheckoutOrder(
  adId: string,
  orderNo: string,
  tier = 'gold',
  userId = author
) {
  const pkgAmount =
    SPONSOR_TIERS.find((t) => t.tier === tier)?.priceInCents ?? 14900;
  await db()
    .insert(order)
    .values({
      id: orderNo,
      orderNo,
      userId,
      userEmail: `${userId}@example.test`,
      status: 'created',
      amount: pkgAmount,
      currency: 'usd',
      productId: `directory_sponsor_${tier}`,
      paymentType: 'subscription',
      paymentProvider: 'stripe',
      paymentSessionId: `cs_${orderNo}`,
      checkoutInfo: '{}',
      checkoutUrl: `https://pay.example/checkout/${orderNo}`,
      reference: directoryAdOrderReference(adId),
    });
  const [row] = await db()
    .select()
    .from(order)
    .where(eq(order.orderNo, orderNo));
  return row;
}

const paid = (orderNo: string, amount: number) => ({
  paymentStatus: 'paid',
  paymentResult: { id: orderNo },
  paymentInfo: {
    transactionId: `pi_${orderNo}`,
    amount,
    paymentAmount: amount,
    paymentCurrency: 'usd',
    paidAt: new Date(),
  },
});

const failed = (orderNo: string) => ({
  paymentStatus: 'failed',
  paymentResult: { id: orderNo, error: 'card_declined' },
  paymentInfo: {},
});

const canceled = (orderNo: string) => ({
  paymentStatus: 'canceled',
  paymentResult: { id: orderNo },
  paymentInfo: {},
});

async function readTool(id: string) {
  const [row] = await db()
    .select()
    .from(directoryTool)
    .where(eq(directoryTool.id, id));
  return row;
}

async function readAd(id: string) {
  const [row] = await db()
    .select()
    .from(directorySponsorAd)
    .where(eq(directorySponsorAd.id, id));
  return row;
}

async function orderStatus(orderNo: string) {
  const [row] = await db()
    .select()
    .from(order)
    .where(eq(order.orderNo, orderNo));
  return row.status;
}

// --- Form validation (submit) ---

test('submit form rejects missing required fields', async () => {
  await assert.rejects(
    () =>
      submitDirectoryTool(
        formPremium({ name: '', websiteUrl: 'https://x.test', tagline: 't' })
      ),
    /Missing required fields/
  );
  await assert.rejects(
    () =>
      submitDirectoryTool(
        formPremium({ websiteUrl: 'not-a-url', name: 'X', tagline: 't' })
      ),
    /Invalid website URL/
  );
  await assert.rejects(
    () =>
      submitDirectoryTool(
        formPremium({ categoryId: 'missing-cat', name: 'X', tagline: 't' })
      ),
    /Invalid category/
  );
});

test('free submit creates pending review row without checkout', async () => {
  const result = await submitDirectoryTool(
    formPremium({ plan: 'free', name: 'Free Tool' })
  );
  assert.equal(result.status, 'pending');
  assert.equal(result.plan, 'free');
  assert.equal(result.priceInCents, 0);
  const tool = await readTool(result.id);
  assert.equal(tool.status, 'pending');
  assert.equal(tool.source, 'community');
  assert.equal(tool.featured, false);
  const [tr] = await db()
    .select()
    .from(directoryToolTranslation)
    .where(eq(directoryToolTranslation.toolId, result.id));
  assert.equal(tr.name, 'Free Tool');
  assert.equal(tr.tagline, 'A solid tagline for the form');
  await assert.rejects(
    () => getPayableDirectoryTool(result.id, author),
    /not awaiting payment/
  );
});

test('premium submit → pay success publishes + features 30 days', async () => {
  const result = await submitDirectoryTool(
    formPremium({ name: 'Premium Tool Success' })
  );
  assert.equal(result.status, 'pending_payment');
  assert.equal(result.priceInCents, 3900);

  const payable = await getPayableDirectoryTool(result.id, author);
  assert.equal(payable.pkg.productId, 'directory_submit_premium');

  const o = await toolCheckoutOrder(result.id, 'ORD-TOOL-OK');
  await settleCheckoutOrder(o, paid(o.orderNo, o.amount), 'stripe');

  const tool = await readTool(result.id);
  assert.equal(tool.status, 'published');
  assert.equal(tool.featured, true);
  assert.ok(tool.featuredUntil);
  assert.ok(tool.publishedAt);
  const days =
    (new Date(tool.featuredUntil!).getTime() - Date.now()) / 86400000;
  assert.ok(days > 28 && days < 32, `featuredDays≈30 got ${days}`);
  assert.equal(await orderStatus(o.orderNo), 'paid');
});

test('premium submit → pay failure leaves listing pending_payment', async () => {
  const result = await submitDirectoryTool(
    formPremium({ name: 'Premium Tool Fail' })
  );
  const o = await toolCheckoutOrder(result.id, 'ORD-TOOL-FAIL');
  await settleCheckoutOrder(o, failed(o.orderNo), 'stripe');

  const tool = await readTool(result.id);
  assert.equal(tool.status, 'pending_payment');
  assert.equal(tool.featured, false);
  assert.equal(tool.publishedAt, null);
  assert.equal(await orderStatus(o.orderNo), 'failed');
});

test('premium submit → canceled checkout does not publish', async () => {
  const result = await submitDirectoryTool(
    formPremium({ name: 'Premium Tool Cancel' })
  );
  const o = await toolCheckoutOrder(result.id, 'ORD-TOOL-CANCEL');
  await settleCheckoutOrder(o, canceled(o.orderNo), 'stripe');
  assert.equal((await readTool(result.id)).status, 'pending_payment');
  assert.equal(await orderStatus(o.orderNo), 'failed');
});

test('another user cannot pay for someone else submission', async () => {
  const result = await submitDirectoryTool(formPremium({ name: 'Owned Tool' }));
  await assert.rejects(
    () => getPayableDirectoryTool(result.id, other),
    /Submission not found/
  );
});

test('paid premium settle is idempotent under replay', async () => {
  const result = await submitDirectoryTool(
    formPremium({ name: 'Replay Tool' })
  );
  const o = await toolCheckoutOrder(result.id, 'ORD-TOOL-REPLAY');
  for (let i = 0; i < 3; i++) {
    await settleCheckoutOrder(o, paid(o.orderNo, o.amount), 'stripe');
  }
  assert.equal((await readTool(result.id)).status, 'published');
  assert.equal(await orderStatus(o.orderNo), 'paid');
});

// --- Form validation + payment (advertise) ---

test('advertise form rejects bad input', async () => {
  await assert.rejects(
    () =>
      createSponsorAd(
        formAd({ name: '', tagline: 't', url: 'https://x.test' })
      ),
    /Missing required fields/
  );
  await assert.rejects(
    () => createSponsorAd(formAd({ url: 'bad', name: 'N', tagline: 't' })),
    /Invalid URL/
  );
  await assert.rejects(
    () =>
      createSponsorAd({
        ...formAd(),
        tier: 'diamond' as any,
      }),
    /Invalid sponsor tier/
  );
});

test('advertise → pay success activates sponsor slot', async () => {
  const uid = 'ad-ok-user';
  await ensureUser(uid);
  const result = await createSponsorAd(
    formAd({ userId: uid, name: 'Gold Ad OK' })
  );
  assert.equal(result.status, 'pending_payment');
  assert.equal(result.tier, 'gold');
  assert.equal(result.priceInCents, 14900);

  const payable = await getPayableDirectoryAd(result.id, uid);
  assert.equal(payable.pkg.productId, 'directory_sponsor_gold');
  assert.ok(payable.pkg.type === 'subscription' || payable.pkg.plan);

  const o = await adCheckoutOrder(result.id, 'ORD-AD-OK', 'gold', uid);
  await settleCheckoutOrder(o, paid(o.orderNo, o.amount), 'stripe');

  const ad = await readAd(result.id);
  assert.equal(ad.status, 'active');
  assert.ok(ad.startsAt);
  assert.ok(ad.endsAt);
  const days = (new Date(ad.endsAt!).getTime() - Date.now()) / 86400000;
  assert.ok(days > 28 && days < 32, `ad period≈30 got ${days}`);
  assert.equal(await orderStatus(o.orderNo), 'paid');
});

test('advertise → pay failure keeps pending_payment hold', async () => {
  const uid = 'ad-fail-user';
  await ensureUser(uid);
  const result = await createSponsorAd(
    formAd({
      userId: uid,
      name: 'Gold Ad Fail',
      url: 'https://example.test/fail',
    })
  );
  const o = await adCheckoutOrder(result.id, 'ORD-AD-FAIL', 'gold', uid);
  await settleCheckoutOrder(o, failed(o.orderNo), 'stripe');

  const ad = await readAd(result.id);
  assert.equal(ad.status, 'pending_payment');
  assert.equal(ad.startsAt, null);
  assert.equal(await orderStatus(o.orderNo), 'failed');
});

test('advertise → canceled checkout keeps inventory hold', async () => {
  const uid = 'ad-cancel-user';
  await ensureUser(uid);
  const result = await createSponsorAd(
    formAd({
      userId: uid,
      name: 'Gold Ad Cancel',
      url: 'https://example.test/cancel',
    })
  );
  const o = await adCheckoutOrder(result.id, 'ORD-AD-CANCEL', 'gold', uid);
  await settleCheckoutOrder(o, canceled(o.orderNo), 'stripe');
  assert.equal((await readAd(result.id)).status, 'pending_payment');
  assert.equal(await orderStatus(o.orderNo), 'failed');
});

test('open checkout url is reused for the same unpaid ad', async () => {
  const uid = 'ad-reuse-user';
  await ensureUser(uid);
  const result = await createSponsorAd(
    formAd({
      userId: uid,
      name: 'Reuse Checkout',
      url: 'https://example.test/reuse',
    })
  );
  await adCheckoutOrder(result.id, 'ORD-AD-REUSE', 'gold', uid);
  const payable = await getPayableDirectoryAd(result.id, uid);
  assert.equal(
    payable.existingCheckoutUrl,
    'https://pay.example/checkout/ORD-AD-REUSE'
  );
});

test('unpaid hold blocks another booking; same-tier live seat blocks restack', async () => {
  const uid = 'ad-multi-user';
  await ensureUser(uid);
  const first = await createSponsorAd(
    formAd({
      userId: uid,
      name: 'Seat One',
      url: 'https://example.test/seat-1',
    })
  );
  await assert.rejects(
    () =>
      createSponsorAd(
        formAd({
          userId: uid,
          name: 'Seat Two Early',
          url: 'https://example.test/seat-2-early',
        })
      ),
    /pending_checkout/
  );

  const o = await adCheckoutOrder(first.id, 'ORD-AD-MULTI-1', 'gold', uid);
  await settleCheckoutOrder(o, paid(o.orderNo, o.amount), 'stripe');
  assert.equal((await readAd(first.id)).status, 'active');

  await assert.rejects(
    () =>
      createSponsorAd(
        formAd({
          userId: uid,
          name: 'Seat Two Same Tier',
          url: 'https://example.test/seat-2',
          tier: 'gold',
        })
      ),
    /tier_already_held/
  );

  // Cross-tier is still allowed while a gold seat is live.
  const silver = await createSponsorAd(
    formAd({
      userId: uid,
      name: 'Seat Silver',
      url: 'https://example.test/seat-silver',
      tier: 'silver',
    })
  );
  assert.equal(silver.status, 'pending_payment');
  assert.equal(silver.tier, 'silver');
});

test('tier inventory form path refuses sold_out', async () => {
  const buyer = 'ad-soldout-buyer';
  const filler = 'ad-soldout-filler';
  await ensureUser(buyer);
  await ensureUser(filler);
  const silverSpots =
    SPONSOR_TIERS.find((t) => t.tier === 'silver')?.spots ?? 12;
  const now = new Date();
  for (let i = 0; i < silverSpots; i++) {
    await db()
      .insert(directorySponsorAd)
      .values({
        id: `fill-silver-form-${i}`,
        userId: filler,
        name: `Filled ${i}`,
        tagline: 'taken',
        url: 'https://example.test/fill',
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
      createSponsorAd(
        formAd({
          userId: buyer,
          name: 'Overflow',
          url: 'https://example.test/overflow',
          tier: 'silver',
        })
      ),
    /sold_out/
  );
});
