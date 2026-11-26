/**
 * MySQL schema definitions.
 *
 * This is the MySQL dialect of the database schema.
 * To use: set DATABASE_PROVIDER=mysql in .env.local,
 * then copy this file's content into schema.ts.
 */

import {
  boolean,
  index,
  int,
  longtext,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/mysql-core';

const table = mysqlTable;

const varchar191 = (name: string) => varchar(name, { length: 191 });

// ─── Auth ────────────────────────────────────────────────────────────────────

export const user = table(
  'user',
  {
    id: varchar191('id').primaryKey(),
    name: varchar191('name').notNull(),
    email: varchar191('email').notNull().unique(),
    emailVerified: boolean('email_verified').default(false).notNull(),
    image: text('image'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
    utmSource: varchar('utm_source', { length: 100 }).notNull().default(''),
    ip: varchar('ip', { length: 45 }).notNull().default(''),
    locale: varchar('locale', { length: 20 }).notNull().default(''),
    utmCampaign: varchar('utm_campaign', { length: 100 }).notNull().default(''),
    utmTerm: varchar('utm_term', { length: 100 }).notNull().default(''),
    utmMedium: varchar('utm_medium', { length: 100 }).notNull().default(''),
    utmContent: varchar('utm_content', { length: 100 }).notNull().default(''),
    referrer: varchar('referrer', { length: 500 }).notNull().default(''),
    country: varchar('country', { length: 10 }).notNull().default(''),
    // 'user' = a person; 'api' = an agent/service account (no login, keys only).
    type: varchar('type', { length: 20 }).notNull().default('user'),
  },
  (table) => [
    index('idx_user_name').on(table.name),
    index('idx_user_created_at').on(table.createdAt),
  ]
);

export const session = table(
  'session',
  {
    id: varchar191('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: varchar191('token').notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    userId: varchar191('user_id')
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
    id: varchar191('id').primaryKey(),
    accountId: varchar191('account_id').notNull(),
    providerId: varchar('provider_id', { length: 50 }).notNull(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: varchar('scope', { length: 255 }),
    password: text('password'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index('idx_account_user_id').on(table.userId),
    index('idx_account_provider_account').on(table.providerId, table.accountId),
  ]
);

export const verification = table(
  'verification',
  {
    id: varchar191('id').primaryKey(),
    identifier: varchar191('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index('idx_verification_identifier').on(table.identifier)]
);

// ─── Content ─────────────────────────────────────────────────────────────────

export const config = table('config', {
  name: varchar191('name').unique().notNull(),
  value: text('value'),
});

export const taxonomy = table(
  'taxonomy',
  {
    id: varchar191('id').primaryKey(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    parentId: varchar191('parent_id'),
    slug: varchar191('slug').unique().notNull(),
    type: varchar('type', { length: 50 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    image: text('image'),
    icon: varchar191('icon'),
    status: varchar('status', { length: 50 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp('deleted_at'),
    sort: int('sort').default(0).notNull(),
  },
  (table) => [index('idx_taxonomy_type_status').on(table.type, table.status)]
);

export const post = table(
  'post',
  {
    id: varchar191('id').primaryKey(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    parentId: varchar191('parent_id'),
    slug: varchar191('slug').unique().notNull(),
    type: varchar('type', { length: 50 }).notNull(),
    title: varchar('title', { length: 255 }),
    description: text('description'),
    image: text('image'),
    content: longtext('content'),
    categories: text('categories'),
    tags: text('tags'),
    authorName: varchar191('author_name'),
    authorImage: text('author_image'),
    status: varchar('status', { length: 50 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp('deleted_at'),
    sort: int('sort').default(0).notNull(),
  },
  (table) => [index('idx_post_type_status').on(table.type, table.status)]
);

// ─── Business ────────────────────────────────────────────────────────────────

export const order = table(
  'order',
  {
    id: varchar191('id').primaryKey(),
    orderNo: varchar191('order_no').unique().notNull(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    userEmail: varchar191('user_email'),
    status: varchar('status', { length: 50 }).notNull(),
    amount: int('amount').notNull(),
    currency: varchar('currency', { length: 10 }).notNull(),
    productId: varchar191('product_id'),
    paymentType: varchar('payment_type', { length: 50 }),
    paymentInterval: varchar('payment_interval', { length: 50 }),
    paymentProvider: varchar('payment_provider', { length: 50 }).notNull(),
    paymentSessionId: varchar191('payment_session_id'),
    checkoutInfo: text('checkout_info').notNull(),
    checkoutResult: text('checkout_result'),
    paymentResult: text('payment_result'),
    discountCode: varchar191('discount_code'),
    discountAmount: int('discount_amount'),
    discountCurrency: varchar('discount_currency', { length: 10 }),
    paymentEmail: varchar191('payment_email'),
    paymentAmount: int('payment_amount'),
    paymentCurrency: varchar('payment_currency', { length: 10 }),
    paidAt: timestamp('paid_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp('deleted_at'),
    description: text('description'),
    productName: varchar('product_name', { length: 255 }),
    subscriptionId: varchar191('subscription_id'),
    subscriptionResult: text('subscription_result'),
    checkoutUrl: text('checkout_url'),
    callbackUrl: text('callback_url'),
    // What the order buys beyond productId, as `<kind>:<id>` (e.g.
    // `guest_post:<id>`). Set at checkout; read back by fulfillment.
    reference: varchar('reference', { length: 255 }),
    creditsAmount: int('credits_amount'),
    creditsValidDays: int('credits_valid_days'),
    planName: varchar191('plan_name'),
    paymentProductId: varchar191('payment_product_id'),
    invoiceId: varchar191('invoice_id'),
    invoiceUrl: text('invoice_url'),
    subscriptionNo: varchar191('subscription_no'),
    transactionId: varchar191('transaction_id'),
    paymentUserName: varchar191('payment_user_name'),
    paymentUserId: varchar191('payment_user_id'),
    refundAmount: int('refund_amount'),
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
    id: varchar191('id').primaryKey(),
    subscriptionNo: varchar191('subscription_no').unique().notNull(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    userEmail: varchar191('user_email'),
    status: varchar('status', { length: 50 }).notNull(),
    paymentProvider: varchar('payment_provider', { length: 50 }).notNull(),
    subscriptionId: varchar191('subscription_id').notNull(),
    subscriptionResult: text('subscription_result'),
    productId: varchar191('product_id'),
    description: text('description'),
    amount: int('amount'),
    currency: varchar('currency', { length: 10 }),
    interval: varchar('interval', { length: 50 }),
    intervalCount: int('interval_count'),
    trialPeriodDays: int('trial_period_days'),
    currentPeriodStart: timestamp('current_period_start'),
    currentPeriodEnd: timestamp('current_period_end'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp('deleted_at'),
    planName: varchar191('plan_name'),
    billingUrl: text('billing_url'),
    productName: varchar('product_name', { length: 255 }),
    creditsAmount: int('credits_amount'),
    creditsValidDays: int('credits_valid_days'),
    paymentProductId: varchar191('payment_product_id'),
    paymentUserId: varchar191('payment_user_id'),
    canceledAt: timestamp('canceled_at'),
    canceledEndAt: timestamp('canceled_end_at'),
    canceledReason: text('canceled_reason'),
    canceledReasonType: varchar('canceled_reason_type', { length: 50 }),
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
    id: varchar191('id').primaryKey(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    userEmail: varchar191('user_email'),
    orderNo: varchar191('order_no'),
    subscriptionNo: varchar191('subscription_no'),
    transactionNo: varchar191('transaction_no').unique().notNull(),
    transactionType: varchar('transaction_type', { length: 50 }).notNull(),
    transactionScene: varchar('transaction_scene', { length: 50 }),
    credits: int('credits').notNull(),
    remainingCredits: int('remaining_credits').notNull().default(0),
    description: text('description'),
    expiresAt: timestamp('expires_at'),
    status: varchar('status', { length: 50 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
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
    id: varchar191('id').primaryKey(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    keyHash: varchar191('key_hash').notNull(),
    keyPrefix: varchar191('key_prefix').notNull(),
    key: varchar191('key'),
    title: varchar191('title').notNull(),
    status: varchar('status', { length: 50 }).notNull(),
    lastUsedAt: timestamp('last_used_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp('deleted_at'),
    // 'user' = product API key (sk_); 'admin' = admin/agent API key (sa_admin_).
    type: varchar('type', { length: 20 }).notNull().default('user'),
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
    id: varchar191('id').primaryKey(),
    name: varchar191('name').notNull().unique(),
    title: varchar191('title').notNull(),
    description: text('description'),
    status: varchar('status', { length: 50 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
    sort: int('sort').default(0).notNull(),
  },
  (table) => [index('idx_role_status').on(table.status)]
);

export const permission = table(
  'permission',
  {
    id: varchar191('id').primaryKey(),
    code: varchar191('code').notNull().unique(),
    resource: varchar('resource', { length: 50 }).notNull(),
    action: varchar('action', { length: 50 }).notNull(),
    title: varchar191('title').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index('idx_permission_resource_action').on(table.resource, table.action),
  ]
);

export const rolePermission = table(
  'role_permission',
  {
    id: varchar191('id').primaryKey(),
    roleId: varchar191('role_id')
      .notNull()
      .references(() => role.id, { onDelete: 'cascade' }),
    permissionId: varchar191('permission_id')
      .notNull()
      .references(() => permission.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
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
    id: varchar191('id').primaryKey(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    roleId: varchar191('role_id')
      .notNull()
      .references(() => role.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
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
    id: varchar191('id').primaryKey(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    mediaType: varchar('media_type', { length: 50 }).notNull(),
    provider: varchar('provider', { length: 50 }).notNull(),
    model: varchar191('model').notNull(),
    prompt: longtext('prompt').notNull(),
    options: longtext('options'),
    status: varchar('status', { length: 50 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp('deleted_at'),
    taskId: varchar191('task_id'),
    taskInfo: longtext('task_info'),
    taskResult: longtext('task_result'),
    costCredits: int('cost_credits').notNull().default(0),
    scene: varchar('scene', { length: 100 }).notNull().default(''),
    creditId: varchar191('credit_id'),
  },
  (table) => [
    index('idx_ai_task_user_media_type').on(table.userId, table.mediaType),
    index('idx_ai_task_media_type_status').on(table.mediaType, table.status),
  ]
);

export const chat = table(
  'chat',
  {
    id: varchar191('id').primaryKey(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 50 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
    model: varchar191('model').notNull(),
    provider: varchar('provider', { length: 50 }).notNull(),
    title: varchar('title', { length: 255 }).notNull().default(''),
    parts: longtext('parts').notNull(),
    metadata: longtext('metadata'),
    content: longtext('content'),
  },
  (table) => [index('idx_chat_user_status').on(table.userId, table.status)]
);

export const chatMessage = table(
  'chat_message',
  {
    id: varchar191('id').primaryKey(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    chatId: varchar191('chat_id')
      .notNull()
      .references(() => chat.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 50 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
    role: varchar('role', { length: 50 }).notNull(),
    parts: longtext('parts').notNull(),
    metadata: longtext('metadata'),
    model: varchar191('model').notNull(),
    provider: varchar('provider', { length: 50 }).notNull(),
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
    id: varchar191('id').primaryKey(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id),
    title: varchar('title', { length: 255 }).notNull(),
    status: varchar('status', { length: 50 }).notNull().default('open'), // open | replied | closed
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  },
  (t) => [
    index('idx_ticket_user').on(t.userId),
    index('idx_ticket_status').on(t.status),
  ]
);

export const ticketMessage = table(
  'ticket_message',
  {
    id: varchar191('id').primaryKey(),
    ticketId: varchar191('ticket_id')
      .notNull()
      .references(() => ticket.id),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id),
    role: varchar('role', { length: 50 }).notNull().default('user'), // user | admin
    content: longtext('content').notNull(),
    attachments: longtext('attachments').notNull(), // JSON array of image URLs (default [] set by service)
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
    id: varchar191('id').primaryKey(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    postId: varchar191('post_id')
      .notNull()
      .unique()
      .references(() => post.id, { onDelete: 'cascade' }),
    productId: varchar('product_id', { length: 100 }).notNull(), // guest post package in pricing.ts
    status: varchar('status', { length: 50 }).notNull(),
    reviewNote: text('review_note'),
    orderNo: varchar191('order_no'), // the order that paid for it
    submittedAt: timestamp('submitted_at'),
    publishedAt: timestamp('published_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
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

// Agent administration: durable execution journal. Agents are `user.type = 'api'`
// accounts whose credentials are `apikey.type = 'admin'` rows; tokenId → apikey.id.
export const adminExecution = table(
  'admin_execution',
  {
    id: varchar191('id').primaryKey(),
    userId: varchar191('user_id').notNull(),
    tokenId: varchar191('token_id'),
    operation: varchar191('operation').notNull(),
    inputHash: varchar191('input_hash').notNull(),
    targetId: varchar191('target_id'),
    status: varchar191('status').notNull(),
    response: longtext('response'),
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
    id: varchar191('id').primaryKey(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    kind: varchar191('kind').notNull(),
    detail: text('detail'),
    source: varchar191('source').notNull(), // server | client
    createdAt: timestamp('created_at', { fsp: 3 }).notNull(),
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
  id: varchar191('id').primaryKey(),
  userId: varchar191('user_id')
    .unique()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  userEmail: varchar191('user_email').notNull().default(''),
  status: varchar191('status').notNull(), // pending | active | rejected
  // Own commission %. 0 = the global setting.
  commissionPercent: int('commission_percent').notNull().default(0),
  applyReason: text('apply_reason').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

// Invite links (`?ref=<code>` on any page), one per channel.
export const affiliateInviteCode = table(
  'affiliate_invite_code',
  {
    id: varchar191('id').primaryKey(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    code: varchar191('code').notNull().unique(),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  },
  (t) => [index('idx_affiliate_invite_code_user').on(t.userId)]
);

// Who invited whom (recorded at sign-up). One inviter per user.
export const affiliateInvite = table(
  'affiliate_invite',
  {
    id: varchar191('id').primaryKey(),
    userId: varchar191('user_id') // inviter
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    inviteUserId: varchar191('invite_user_id') // invitee
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: 'cascade' }),
    inviteCode: varchar191('invite_code').notNull().default(''),
    status: varchar191('status').notNull().default('active'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('idx_affiliate_invite_user').on(t.userId, t.createdAt)]
);

// Cash rewards. `transactionNo` is `aff_<orderNo>`: one per order.
export const affiliateReward = table(
  'affiliate_reward',
  {
    id: varchar191('id').primaryKey(),
    transactionNo: varchar191('transaction_no').notNull().unique(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    orderNo: varchar191('order_no').notNull().default(''),
    rewardType: varchar191('reward_type').notNull().default('cash'), // cash | manual
    rewardPercent: int('reward_percent').notNull().default(0),
    rewardAmount: int('reward_amount').notNull().default(0),
    rewardCurrency: varchar191('reward_currency').notNull().default(''),
    rewardScene: varchar191('reward_scene').notNull().default(''),
    status: varchar191('status').notNull().default('active'), // active | revoked
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
    id: varchar191('id').primaryKey(),
    transactionNo: varchar191('transaction_no').notNull().unique(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    amount: int('amount').notNull().default(0),
    currency: varchar191('currency').notNull().default(''),
    status: varchar191('status').notNull().default('pending'), // pending | success | rejected
    description: text('description').notNull(), // payout account
    remark: text('remark').notNull(), // admin note
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
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
    id: varchar191('id').primaryKey(),
    slug: varchar191('slug').unique().notNull(),
    icon: varchar191('icon'),
    sort: int('sort').default(0).notNull(),
    status: varchar('status', { length: 50 }).default('published').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  },
  (t) => [
    index('idx_dir_cat_slug').on(t.slug),
    index('idx_dir_cat_sort').on(t.sort),
  ]
);

export const directoryCategoryTranslation = table(
  'directory_category_translation',
  {
    id: varchar191('id').primaryKey(),
    categoryId: varchar191('category_id')
      .notNull()
      .references(() => directoryCategory.id, { onDelete: 'cascade' }),
    locale: varchar('locale', { length: 20 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('uq_dir_cat_trans_cat_loc').on(t.categoryId, t.locale)]
);

export const directoryTag = table(
  'directory_tag',
  {
    id: varchar191('id').primaryKey(),
    slug: varchar191('slug').unique().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  },
  (t) => [index('idx_dir_tag_slug').on(t.slug)]
);

export const directoryTagTranslation = table(
  'directory_tag_translation',
  {
    id: varchar191('id').primaryKey(),
    tagId: varchar191('tag_id')
      .notNull()
      .references(() => directoryTag.id, { onDelete: 'cascade' }),
    locale: varchar('locale', { length: 20 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('uq_dir_tag_trans_tag_loc').on(t.tagId, t.locale)]
);

export const directoryTool = table(
  'directory_tool',
  {
    id: varchar191('id').primaryKey(),
    slug: varchar191('slug').unique().notNull(),
    iconUrl: text('icon_url'),
    websiteUrl: text('website_url'),
    pricing: varchar('pricing', { length: 50 }).default('free').notNull(),
    authorName: varchar191('author_name'),
    categoryId: varchar191('category_id').references(
      () => directoryCategory.id,
      { onDelete: 'set null' }
    ),
    screenshots: text('screenshots'),
    // editorial = curated/crawl; community = user submission
    source: varchar('source', { length: 50 }).default('editorial').notNull(),
    // free | premium — user submit plan; null for editorial
    plan: varchar('plan', { length: 50 }),
    submittedBy: varchar191('submitted_by').references(() => user.id, {
      onDelete: 'set null',
    }),
    featured: boolean('featured').default(false).notNull(),
    featuredUntil: timestamp('featured_until'),
    sponsored: boolean('sponsored').default(false).notNull(),
    sort: int('sort').default(0).notNull(),
    // published | pending | pending_payment | rejected
    status: varchar('status', { length: 50 }).default('published').notNull(),
    publishedAt: timestamp('published_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
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
    id: varchar191('id').primaryKey(),
    toolId: varchar191('tool_id')
      .notNull()
      .references(() => directoryTool.id, { onDelete: 'cascade' }),
    locale: varchar('locale', { length: 20 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    tagline: text('tagline'),
    introduction: longtext('introduction'),
    howToUse: longtext('how_to_use'),
    features: longtext('features'),
    useCases: longtext('use_cases'),
    faqs: longtext('faqs'),
    pros: text('pros'),
    cons: text('cons'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('uq_dir_tool_trans_tool_loc').on(t.toolId, t.locale)]
);

export const directoryToolTag = table(
  'directory_tool_tag',
  {
    toolId: varchar191('tool_id')
      .notNull()
      .references(() => directoryTool.id, { onDelete: 'cascade' }),
    tagId: varchar191('tag_id')
      .notNull()
      .references(() => directoryTag.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.toolId, t.tagId] })]
);

export const directorySponsorAd = table(
  'directory_sponsor_ad',
  {
    id: varchar191('id').primaryKey(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    tagline: text('tagline'),
    url: text('url').notNull(),
    iconUrl: text('icon_url'),
    // silver | gold | platinum
    tier: varchar('tier', { length: 50 }).notNull(),
    // pending_payment | active | expired
    status: varchar('status', { length: 50 })
      .default('pending_payment')
      .notNull(),
    startsAt: timestamp('starts_at'),
    endsAt: timestamp('ends_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
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
    id: varchar191('id').primaryKey(),
    slug: varchar191('slug').unique().notNull(),
    icon: varchar('icon', { length: 100 }),
    coverUrl: text('cover_url'),
    sort: int('sort').default(0).notNull(),
    status: varchar('status', { length: 50 }).default('published').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  },
  (t) => [
    index('idx_dir_col_slug').on(t.slug),
    index('idx_dir_col_sort').on(t.sort),
  ]
);

export const directoryCollectionTranslation = table(
  'directory_collection_translation',
  {
    id: varchar191('id').primaryKey(),
    collectionId: varchar191('collection_id')
      .notNull()
      .references(() => directoryCollection.id, { onDelete: 'cascade' }),
    locale: varchar('locale', { length: 20 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('uq_dir_col_trans_col_loc').on(t.collectionId, t.locale)]
);

export const directoryCollectionTool = table(
  'directory_collection_tool',
  {
    collectionId: varchar191('collection_id')
      .notNull()
      .references(() => directoryCollection.id, { onDelete: 'cascade' }),
    toolId: varchar191('tool_id')
      .notNull()
      .references(() => directoryTool.id, { onDelete: 'cascade' }),
    sort: int('sort').default(0).notNull(),
  },
  (t) => [primaryKey({ columns: [t.collectionId, t.toolId] })]
);

export type DirectoryCollection = typeof directoryCollection.$inferSelect;
export type DirectoryCollectionTranslation =
  typeof directoryCollectionTranslation.$inferSelect;
