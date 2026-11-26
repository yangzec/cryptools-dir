/**
 * PostgreSQL schema definitions.
 *
 * This is the PostgreSQL dialect of the database schema.
 * To use: set DATABASE_PROVIDER=postgres in .env.local,
 * then copy this file's content into schema.ts.
 */

import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

const table = pgTable;

// ─── Auth ────────────────────────────────────────────────────────────────────

export const user = table(
  'user',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('email_verified').default(false).notNull(),
    image: text('image'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    utmSource: text('utm_source').notNull().default(''),
    ip: text('ip').notNull().default(''),
    locale: text('locale').notNull().default(''),
    utmCampaign: text('utm_campaign').notNull().default(''),
    utmTerm: text('utm_term').notNull().default(''),
    utmMedium: text('utm_medium').notNull().default(''),
    utmContent: text('utm_content').notNull().default(''),
    referrer: text('referrer').notNull().default(''),
    country: text('country').notNull().default(''),
    // 'user' = a person; 'api' = an agent/service account (no login, keys only).
    type: text('type').notNull().default('user'),
  },
  (table) => [
    index('idx_user_name').on(table.name),
    index('idx_user_created_at').on(table.createdAt),
  ]
);

export const session = table(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [
    index('idx_session_user_expires').on(table.userId, table.expiresAt),
  ]
);

export const account = table(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('idx_account_user_id').on(table.userId),
    index('idx_account_provider_account').on(table.providerId, table.accountId),
  ]
);

export const verification = table(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('idx_verification_identifier').on(table.identifier)]
);

// ─── Content ─────────────────────────────────────────────────────────────────

export const config = table('config', {
  name: text('name').unique().notNull(),
  value: text('value'),
});

export const taxonomy = table(
  'taxonomy',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    parentId: text('parent_id'),
    slug: text('slug').unique().notNull(),
    type: text('type').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    image: text('image'),
    icon: text('icon'),
    status: text('status').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
    sort: integer('sort').default(0).notNull(),
  },
  (table) => [index('idx_taxonomy_type_status').on(table.type, table.status)]
);

export const post = table(
  'post',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    parentId: text('parent_id'),
    slug: text('slug').unique().notNull(),
    type: text('type').notNull(),
    title: text('title'),
    description: text('description'),
    image: text('image'),
    content: text('content'),
    categories: text('categories'),
    tags: text('tags'),
    authorName: text('author_name'),
    authorImage: text('author_image'),
    status: text('status').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
    sort: integer('sort').default(0).notNull(),
  },
  (table) => [index('idx_post_type_status').on(table.type, table.status)]
);

// ─── Business ────────────────────────────────────────────────────────────────

export const order = table(
  'order',
  {
    id: text('id').primaryKey(),
    orderNo: text('order_no').unique().notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    userEmail: text('user_email'),
    status: text('status').notNull(),
    amount: integer('amount').notNull(),
    currency: text('currency').notNull(),
    productId: text('product_id'),
    paymentType: text('payment_type'),
    paymentInterval: text('payment_interval'),
    paymentProvider: text('payment_provider').notNull(),
    paymentSessionId: text('payment_session_id'),
    checkoutInfo: text('checkout_info').notNull(),
    checkoutResult: text('checkout_result'),
    paymentResult: text('payment_result'),
    discountCode: text('discount_code'),
    discountAmount: integer('discount_amount'),
    discountCurrency: text('discount_currency'),
    paymentEmail: text('payment_email'),
    paymentAmount: integer('payment_amount'),
    paymentCurrency: text('payment_currency'),
    paidAt: timestamp('paid_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
    description: text('description'),
    productName: text('product_name'),
    subscriptionId: text('subscription_id'),
    subscriptionResult: text('subscription_result'),
    checkoutUrl: text('checkout_url'),
    callbackUrl: text('callback_url'),
    // What the order buys beyond productId, as `<kind>:<id>` (e.g.
    // `guest_post:<id>`). Set at checkout; read back by fulfillment.
    reference: text('reference'),
    creditsAmount: integer('credits_amount'),
    creditsValidDays: integer('credits_valid_days'),
    planName: text('plan_name'),
    paymentProductId: text('payment_product_id'),
    invoiceId: text('invoice_id'),
    invoiceUrl: text('invoice_url'),
    subscriptionNo: text('subscription_no'),
    transactionId: text('transaction_id'),
    paymentUserName: text('payment_user_name'),
    paymentUserId: text('payment_user_id'),
    refundAmount: integer('refund_amount'),
    refundedAt: timestamp('refunded_at'),
    refundResult: text('refund_result'),
  },
  (table) => [
    index('idx_order_user_status_payment_type').on(
      table.userId,
      table.status,
      table.paymentType
    ),
    index('idx_order_transaction_provider').on(
      table.transactionId,
      table.paymentProvider
    ),
    index('idx_order_created_at').on(table.createdAt),
  ]
);

export const subscription = table(
  'subscription',
  {
    id: text('id').primaryKey(),
    subscriptionNo: text('subscription_no').unique().notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    userEmail: text('user_email'),
    status: text('status').notNull(),
    paymentProvider: text('payment_provider').notNull(),
    subscriptionId: text('subscription_id').notNull(),
    subscriptionResult: text('subscription_result'),
    productId: text('product_id'),
    description: text('description'),
    amount: integer('amount'),
    currency: text('currency'),
    interval: text('interval'),
    intervalCount: integer('interval_count'),
    trialPeriodDays: integer('trial_period_days'),
    currentPeriodStart: timestamp('current_period_start'),
    currentPeriodEnd: timestamp('current_period_end'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
    planName: text('plan_name'),
    billingUrl: text('billing_url'),
    productName: text('product_name'),
    creditsAmount: integer('credits_amount'),
    creditsValidDays: integer('credits_valid_days'),
    paymentProductId: text('payment_product_id'),
    paymentUserId: text('payment_user_id'),
    canceledAt: timestamp('canceled_at'),
    canceledEndAt: timestamp('canceled_end_at'),
    canceledReason: text('canceled_reason'),
    canceledReasonType: text('canceled_reason_type'),
  },
  (table) => [
    index('idx_subscription_user_status_interval').on(
      table.userId,
      table.status,
      table.interval
    ),
    index('idx_subscription_provider_id').on(
      table.subscriptionId,
      table.paymentProvider
    ),
    index('idx_subscription_created_at').on(table.createdAt),
  ]
);

export const credit = table(
  'credit',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    userEmail: text('user_email'),
    orderNo: text('order_no'),
    subscriptionNo: text('subscription_no'),
    transactionNo: text('transaction_no').unique().notNull(),
    transactionType: text('transaction_type').notNull(),
    transactionScene: text('transaction_scene'),
    credits: integer('credits').notNull(),
    remainingCredits: integer('remaining_credits').notNull().default(0),
    description: text('description'),
    expiresAt: timestamp('expires_at'),
    status: text('status').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
    consumedDetail: text('consumed_detail'),
    metadata: text('metadata'),
  },
  (table) => [
    index('idx_credit_consume_fifo').on(
      table.userId,
      table.status,
      table.transactionType,
      table.remainingCredits,
      table.expiresAt
    ),
    index('idx_credit_order_no').on(table.orderNo),
    index('idx_credit_subscription_no').on(table.subscriptionNo),
  ]
);

export const apikey = table(
  'apikey',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    keyHash: text('key_hash').notNull(),
    keyPrefix: text('key_prefix').notNull(),
    key: text('key'),
    title: text('title').notNull(),
    status: text('status').notNull(),
    lastUsedAt: timestamp('last_used_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
    // 'user' = product API key (sk_); 'admin' = admin/agent API key (sa_admin_).
    type: text('type').notNull().default('user'),
    expiresAt: timestamp('expires_at'), // null = never expires
  },
  (table) => [
    index('idx_apikey_user_status').on(table.userId, table.status),
    index('idx_apikey_keyhash_status').on(table.keyHash, table.status),
  ]
);

// ─── RBAC ────────────────────────────────────────────────────────────────────

export const role = table(
  'role',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull().unique(),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    sort: integer('sort').default(0).notNull(),
  },
  (table) => [index('idx_role_status').on(table.status)]
);

export const permission = table(
  'permission',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull().unique(),
    resource: text('resource').notNull(),
    action: text('action').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('idx_permission_resource_action').on(table.resource, table.action),
  ]
);

export const rolePermission = table(
  'role_permission',
  {
    id: text('id').primaryKey(),
    roleId: text('role_id')
      .notNull()
      .references(() => role.id, { onDelete: 'cascade' }),
    permissionId: text('permission_id')
      .notNull()
      .references(() => permission.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    index('idx_role_permission_role_permission').on(
      table.roleId,
      table.permissionId
    ),
  ]
);

export const userRole = table(
  'user_role',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    roleId: text('role_id')
      .notNull()
      .references(() => role.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    expiresAt: timestamp('expires_at'),
  },
  (table) => [
    index('idx_user_role_user_expires').on(table.userId, table.expiresAt),
  ]
);

// ─── AI ──────────────────────────────────────────────────────────────────────

export const aiTask = table(
  'ai_task',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    mediaType: text('media_type').notNull(),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    prompt: text('prompt').notNull(),
    options: text('options'),
    status: text('status').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
    taskId: text('task_id'),
    taskInfo: text('task_info'),
    taskResult: text('task_result'),
    costCredits: integer('cost_credits').notNull().default(0),
    scene: text('scene').notNull().default(''),
    creditId: text('credit_id'),
  },
  (table) => [
    index('idx_ai_task_user_media_type').on(table.userId, table.mediaType),
    index('idx_ai_task_media_type_status').on(table.mediaType, table.status),
  ]
);

export const chat = table(
  'chat',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    status: text('status').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    model: text('model').notNull(),
    provider: text('provider').notNull(),
    title: text('title').notNull().default(''),
    parts: text('parts').notNull(),
    metadata: text('metadata'),
    content: text('content'),
  },
  (table) => [index('idx_chat_user_status').on(table.userId, table.status)]
);

export const chatMessage = table(
  'chat_message',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    chatId: text('chat_id')
      .notNull()
      .references(() => chat.id, { onDelete: 'cascade' }),
    status: text('status').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    role: text('role').notNull(),
    parts: text('parts').notNull(),
    metadata: text('metadata'),
    model: text('model').notNull(),
    provider: text('provider').notNull(),
  },
  (table) => [
    index('idx_chat_message_chat_id').on(table.chatId, table.status),
    index('idx_chat_message_user_id').on(table.userId, table.status),
  ]
);

// ─── Types ───────────────────────────────────────────────────────────────────

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;
export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;
export type Verification = typeof verification.$inferSelect;
export type Config = typeof config.$inferSelect;
export type Taxonomy = typeof taxonomy.$inferSelect;
export type NewTaxonomy = typeof taxonomy.$inferInsert;
export type Post = typeof post.$inferSelect;
export type NewPost = typeof post.$inferInsert;
export type Order = typeof order.$inferSelect;
export type NewOrder = typeof order.$inferInsert;
export type Subscription = typeof subscription.$inferSelect;
export type NewSubscription = typeof subscription.$inferInsert;
export type Credit = typeof credit.$inferSelect;
export type NewCredit = typeof credit.$inferInsert;
export type Apikey = typeof apikey.$inferSelect;
export type NewApikey = typeof apikey.$inferInsert;
export type Role = typeof role.$inferSelect;
export type NewRole = typeof role.$inferInsert;
export type Permission = typeof permission.$inferSelect;
export type RolePermission = typeof rolePermission.$inferSelect;
export type UserRole = typeof userRole.$inferSelect;
export type AiTask = typeof aiTask.$inferSelect;
export type NewAiTask = typeof aiTask.$inferInsert;
export type Chat = typeof chat.$inferSelect;
export type NewChat = typeof chat.$inferInsert;
export type ChatMessage = typeof chatMessage.$inferSelect;
export type NewChatMessage = typeof chatMessage.$inferInsert;

// ─── Tickets (support) ───────────────────────────────────────────────────────

export const ticket = table(
  'ticket',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id),
    title: text('title').notNull(),
    status: text('status').notNull().default('open'), // open | replied | closed
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('idx_ticket_user').on(t.userId),
    index('idx_ticket_status').on(t.status),
  ]
);

export const ticketMessage = table(
  'ticket_message',
  {
    id: text('id').primaryKey(),
    ticketId: text('ticket_id')
      .notNull()
      .references(() => ticket.id),
    userId: text('user_id')
      .notNull()
      .references(() => user.id),
    role: text('role').notNull().default('user'), // user | admin
    content: text('content').notNull(),
    attachments: text('attachments').notNull().default('[]'), // JSON array of image URLs
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('idx_ticket_message_ticket').on(t.ticketId)]
);

export type Ticket = typeof ticket.$inferSelect;
export type NewTicket = typeof ticket.$inferInsert;
export type TicketMessage = typeof ticketMessage.$inferSelect;
export type NewTicketMessage = typeof ticketMessage.$inferInsert;

// ─── Guest posts ─────────────────────────────────────────────────────────────
// Paid, reviewed articles from outside authors. The article body lives in
// `post` (type 'guest', status 'draft' until approved); this row tracks the
// submission. Flow: draft → (paid) submitted → (changes_requested ↔
// submitted) → published | rejected (refunded); published → unpublished.
// Checkout orders point back here through order.reference.

export const guestPost = table(
  'guest_post',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    postId: text('post_id')
      .notNull()
      .unique()
      .references(() => post.id, { onDelete: 'cascade' }),
    productId: text('product_id').notNull(), // guest post package in pricing.ts
    status: text('status').notNull(),
    reviewNote: text('review_note'),
    orderNo: text('order_no'), // the order that paid for it
    submittedAt: timestamp('submitted_at'),
    publishedAt: timestamp('published_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index('idx_guest_post_user').on(t.userId),
    index('idx_guest_post_status').on(t.status),
  ]
);

export type GuestPost = typeof guestPost.$inferSelect;
export type NewGuestPost = typeof guestPost.$inferInsert;

// ─── Custom tables ───────────────────────────────────────────────────────────
// Add your own tables below this line.

// ─── Invite Codes ────────────────────────────────────────────────────────────

export const inviteCode = table(
  'invite_code',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull().unique(),
    maxUses: integer('max_uses').notNull().default(1),
    usedCount: integer('used_count').notNull().default(0),
    trialDays: integer('trial_days').notNull().default(15),
    note: text('note').default(''),
    createdBy: text('created_by').references(() => user.id),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('idx_invite_code_code').on(t.code)]
);

export const userInvite = table(
  'user_invite',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id),
    inviteCodeId: text('invite_code_id')
      .notNull()
      .references(() => inviteCode.id),
    activatedAt: timestamp('activated_at').defaultNow().notNull(),
    trialEndsAt: timestamp('trial_ends_at').notNull(),
  },
  (t) => [
    index('idx_user_invite_user').on(t.userId),
    index('idx_user_invite_code').on(t.inviteCodeId),
  ]
);

export type InviteCode = typeof inviteCode.$inferSelect;
export type NewInviteCode = typeof inviteCode.$inferInsert;
export type UserInvite = typeof userInvite.$inferSelect;
export type NewUserInvite = typeof userInvite.$inferInsert;

// Agent administration: durable execution journal. Agents are `user.type = 'api'`
// accounts whose credentials are `apikey.type = 'admin'` rows; tokenId → apikey.id.
export const adminExecution = table(
  'admin_execution',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    tokenId: text('token_id'),
    operation: text('operation').notNull(),
    inputHash: text('input_hash').notNull(),
    targetId: text('target_id'),
    status: text('status').notNull(),
    response: text('response'),
    createdAt: timestamp('created_at').notNull(),
    completedAt: timestamp('completed_at'),
  },
  (t) => [index('idx_admin_execution_created').on(t.createdAt)]
);

export type AdminExecution = typeof adminExecution.$inferSelect;

// Product events (paywall hits, plan picks, risk flags …) that no other table
// records. Kinds are registered in src/config/events.ts; written through
// recordEvent() (server) or track() (client, registered kinds only). Shown in
// the admin user timeline next to orders, credits and tasks.
export const userEvent = table(
  'user_event',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    detail: text('detail'),
    source: text('source').notNull(), // server | client
    createdAt: timestamp('created_at').notNull(),
  },
  (t) => [
    index('idx_user_event_user_created').on(t.userId, t.createdAt),
    index('idx_user_event_kind_created').on(t.kind, t.createdAt),
  ]
);

export type UserEvent = typeof userEvent.$inferSelect;
export type NewUserEvent = typeof userEvent.$inferInsert;

// ─── Affiliates ──────────────────────────────────────────────────────────────
// Referral program: affiliates share invite links; a referred buyer's first
// payment earns their inviter cash (withdrawn later), by the
// rules in admin settings (src/config/affiliates.ts). Percentages are whole
// numbers (20 = 20%); money is in minor units of its own currency.
// Service: src/modules/affiliates/service.ts. Settings → Users → Affiliates.

export const affiliateUser = table('affiliate_user', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .unique()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  userEmail: text('user_email').notNull().default(''),
  status: text('status').notNull(), // pending | active | rejected
  // Own commission %. 0 = the global setting.
  commissionPercent: integer('commission_percent').notNull().default(0),
  applyReason: text('apply_reason').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Invite links (`?ref=<code>` on any page), one per channel.
export const affiliateInviteCode = table(
  'affiliate_invite_code',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    code: text('code').notNull().unique(),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index('idx_affiliate_invite_code_user').on(t.userId)]
);

// Who invited whom (recorded at sign-up). One inviter per user.
export const affiliateInvite = table(
  'affiliate_invite',
  {
    id: text('id').primaryKey(),
    userId: text('user_id') // inviter
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    inviteUserId: text('invite_user_id') // invitee
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: 'cascade' }),
    inviteCode: text('invite_code').notNull().default(''),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('idx_affiliate_invite_user').on(t.userId, t.createdAt)]
);

// Cash rewards. `transactionNo` is `aff_<orderNo>`: one per order.
export const affiliateReward = table(
  'affiliate_reward',
  {
    id: text('id').primaryKey(),
    transactionNo: text('transaction_no').notNull().unique(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    orderNo: text('order_no').notNull().default(''),
    rewardType: text('reward_type').notNull().default('cash'), // cash | manual
    rewardPercent: integer('reward_percent').notNull().default(0),
    rewardAmount: integer('reward_amount').notNull().default(0),
    rewardCurrency: text('reward_currency').notNull().default(''),
    rewardScene: text('reward_scene').notNull().default(''),
    status: text('status').notNull().default('active'), // active | revoked
    // Cash rewards: when it can be withdrawn (null = right away).
    availableAt: timestamp('available_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('idx_affiliate_reward_user').on(t.userId, t.status),
    index('idx_affiliate_reward_order').on(t.orderNo),
  ]
);

// Payout requests, paid by hand by an admin. One per currency per request.
export const affiliateWithdraw = table(
  'affiliate_withdraw',
  {
    id: text('id').primaryKey(),
    transactionNo: text('transaction_no').notNull().unique(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    amount: integer('amount').notNull().default(0),
    currency: text('currency').notNull().default(''),
    status: text('status').notNull().default('pending'), // pending | success | rejected
    description: text('description').notNull().default(''), // payout account
    remark: text('remark').notNull().default(''), // admin note
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index('idx_affiliate_withdraw_user').on(t.userId, t.status)]
);

export type AffiliateUser = typeof affiliateUser.$inferSelect;
export type NewAffiliateUser = typeof affiliateUser.$inferInsert;
export type AffiliateInviteCode = typeof affiliateInviteCode.$inferSelect;
export type NewAffiliateInviteCode = typeof affiliateInviteCode.$inferInsert;
export type AffiliateInvite = typeof affiliateInvite.$inferSelect;
export type NewAffiliateInvite = typeof affiliateInvite.$inferInsert;
export type AffiliateReward = typeof affiliateReward.$inferSelect;
export type NewAffiliateReward = typeof affiliateReward.$inferInsert;
export type AffiliateWithdraw = typeof affiliateWithdraw.$inferSelect;
export type NewAffiliateWithdraw = typeof affiliateWithdraw.$inferInsert;

export const directoryCategory = table(
  'directory_category',
  {
    id: text('id').primaryKey(),
    slug: text('slug').unique().notNull(),
    icon: text('icon'),
    sort: integer('sort').default(0).notNull(),
    status: text('status').default('published').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index('idx_dir_cat_slug').on(t.slug),
    index('idx_dir_cat_sort').on(t.sort),
  ]
);

export const directoryCategoryTranslation = table(
  'directory_category_translation',
  {
    id: text('id').primaryKey(),
    categoryId: text('category_id')
      .notNull()
      .references(() => directoryCategory.id, { onDelete: 'cascade' }),
    locale: text('locale').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('uq_dir_cat_trans_cat_loc').on(t.categoryId, t.locale)]
);

export const directoryTag = table(
  'directory_tag',
  {
    id: text('id').primaryKey(),
    slug: text('slug').unique().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index('idx_dir_tag_slug').on(t.slug)]
);

export const directoryTagTranslation = table(
  'directory_tag_translation',
  {
    id: text('id').primaryKey(),
    tagId: text('tag_id')
      .notNull()
      .references(() => directoryTag.id, { onDelete: 'cascade' }),
    locale: text('locale').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('uq_dir_tag_trans_tag_loc').on(t.tagId, t.locale)]
);

export const directoryTool = table(
  'directory_tool',
  {
    id: text('id').primaryKey(),
    slug: text('slug').unique().notNull(),
    iconUrl: text('icon_url'),
    websiteUrl: text('website_url'),
    pricing: text('pricing').default('free').notNull(),
    authorName: text('author_name'),
    categoryId: text('category_id').references(() => directoryCategory.id, {
      onDelete: 'set null',
    }),
    screenshots: text('screenshots'),
    // editorial = curated/crawl; community = user submission
    source: text('source').default('editorial').notNull(),
    // free | premium — user submit plan; null for editorial
    plan: text('plan'),
    submittedBy: text('submitted_by').references(() => user.id, {
      onDelete: 'set null',
    }),
    featured: boolean('featured').default(false).notNull(),
    featuredUntil: timestamp('featured_until'),
    sponsored: boolean('sponsored').default(false).notNull(),
    sort: integer('sort').default(0).notNull(),
    // published | pending | pending_payment | rejected
    status: text('status').default('published').notNull(),
    publishedAt: timestamp('published_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index('idx_dir_tool_slug').on(t.slug),
    index('idx_dir_tool_cat').on(t.categoryId),
    index('idx_dir_tool_featured').on(t.featured),
    index('idx_dir_tool_sort').on(t.sort),
    index('idx_dir_tool_source').on(t.source),
    index('idx_dir_tool_submitted_by').on(t.submittedBy),
    index('idx_dir_tool_status').on(t.status),
  ]
);

export const directoryToolTranslation = table(
  'directory_tool_translation',
  {
    id: text('id').primaryKey(),
    toolId: text('tool_id')
      .notNull()
      .references(() => directoryTool.id, { onDelete: 'cascade' }),
    locale: text('locale').notNull(),
    name: text('name').notNull(),
    tagline: text('tagline'),
    introduction: text('introduction'),
    howToUse: text('how_to_use'),
    features: text('features'),
    useCases: text('use_cases'),
    faqs: text('faqs'),
    pros: text('pros'),
    cons: text('cons'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('uq_dir_tool_trans_tool_loc').on(t.toolId, t.locale)]
);

export const directoryToolTag = table(
  'directory_tool_tag',
  {
    toolId: text('tool_id')
      .notNull()
      .references(() => directoryTool.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => directoryTag.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.toolId, t.tagId] })]
);

export const directorySponsorAd = table(
  'directory_sponsor_ad',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    tagline: text('tagline'),
    url: text('url').notNull(),
    iconUrl: text('icon_url'),
    // silver | gold | platinum
    tier: text('tier').notNull(),
    // pending_payment | active | expired
    status: text('status').default('pending_payment').notNull(),
    startsAt: timestamp('starts_at'),
    endsAt: timestamp('ends_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index('idx_dir_ad_user').on(t.userId),
    index('idx_dir_ad_status').on(t.status),
    index('idx_dir_ad_tier').on(t.tier),
  ]
);

export type DirectoryCategory = typeof directoryCategory.$inferSelect;
export type DirectoryTool = typeof directoryTool.$inferSelect;
export type DirectoryToolTranslation =
  typeof directoryToolTranslation.$inferSelect;
export type DirectoryTag = typeof directoryTag.$inferSelect;
export type DirectorySponsorAd = typeof directorySponsorAd.$inferSelect;

export const directoryCollection = table(
  'directory_collection',
  {
    id: text('id').primaryKey(),
    slug: text('slug').unique().notNull(),
    icon: text('icon'),
    coverUrl: text('cover_url'),
    sort: integer('sort').default(0).notNull(),
    status: text('status').default('published').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index('idx_dir_col_slug').on(t.slug),
    index('idx_dir_col_sort').on(t.sort),
  ]
);

export const directoryCollectionTranslation = table(
  'directory_collection_translation',
  {
    id: text('id').primaryKey(),
    collectionId: text('collection_id')
      .notNull()
      .references(() => directoryCollection.id, { onDelete: 'cascade' }),
    locale: text('locale').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('uq_dir_col_trans_col_loc').on(t.collectionId, t.locale)]
);

export const directoryCollectionTool = table(
  'directory_collection_tool',
  {
    collectionId: text('collection_id')
      .notNull()
      .references(() => directoryCollection.id, { onDelete: 'cascade' }),
    toolId: text('tool_id')
      .notNull()
      .references(() => directoryTool.id, { onDelete: 'cascade' }),
    sort: integer('sort').default(0).notNull(),
  },
  (t) => [primaryKey({ columns: [t.collectionId, t.toolId] })]
);

export type DirectoryCollection = typeof directoryCollection.$inferSelect;
export type DirectoryCollectionTranslation =
  typeof directoryCollectionTranslation.$inferSelect;
