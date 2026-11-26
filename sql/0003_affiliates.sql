-- Affiliates final schema (after coupon drop). Idempotent for D1/sqlite.
CREATE TABLE IF NOT EXISTS `affiliate_user` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL UNIQUE,
  `user_email` text DEFAULT '' NOT NULL,
  `status` text NOT NULL,
  `commission_percent` integer DEFAULT 0 NOT NULL,
  `apply_reason` text DEFAULT '' NOT NULL,
  `created_at` integer DEFAULT (cast(strftime('%s','now') as integer) * 1000) NOT NULL,
  `updated_at` integer DEFAULT (cast(strftime('%s','now') as integer) * 1000) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS `affiliate_invite_code` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `code` text NOT NULL UNIQUE,
  `is_default` integer DEFAULT false NOT NULL,
  `created_at` integer DEFAULT (cast(strftime('%s','now') as integer) * 1000) NOT NULL,
  `updated_at` integer DEFAULT (cast(strftime('%s','now') as integer) * 1000) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS `idx_affiliate_invite_code_user` ON `affiliate_invite_code` (`user_id`);

CREATE TABLE IF NOT EXISTS `affiliate_invite` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `invite_user_id` text NOT NULL UNIQUE,
  `invite_code` text DEFAULT '' NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `created_at` integer DEFAULT (cast(strftime('%s','now') as integer) * 1000) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade,
  FOREIGN KEY (`invite_user_id`) REFERENCES `user`(`id`) ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS `idx_affiliate_invite_user` ON `affiliate_invite` (`user_id`, `created_at`);

CREATE TABLE IF NOT EXISTS `affiliate_reward` (
  `id` text PRIMARY KEY NOT NULL,
  `transaction_no` text NOT NULL UNIQUE,
  `user_id` text NOT NULL,
  `order_no` text DEFAULT '' NOT NULL,
  `reward_type` text DEFAULT 'cash' NOT NULL,
  `reward_percent` integer DEFAULT 0 NOT NULL,
  `reward_amount` integer DEFAULT 0 NOT NULL,
  `reward_currency` text DEFAULT '' NOT NULL,
  `reward_scene` text DEFAULT '' NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `available_at` integer,
  `created_at` integer DEFAULT (cast(strftime('%s','now') as integer) * 1000) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS `idx_affiliate_reward_user` ON `affiliate_reward` (`user_id`, `status`);
CREATE INDEX IF NOT EXISTS `idx_affiliate_reward_order` ON `affiliate_reward` (`order_no`);

CREATE TABLE IF NOT EXISTS `affiliate_withdraw` (
  `id` text PRIMARY KEY NOT NULL,
  `transaction_no` text NOT NULL UNIQUE,
  `user_id` text NOT NULL,
  `amount` integer DEFAULT 0 NOT NULL,
  `currency` text DEFAULT '' NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `description` text DEFAULT '' NOT NULL,
  `remark` text DEFAULT '' NOT NULL,
  `created_at` integer DEFAULT (cast(strftime('%s','now') as integer) * 1000) NOT NULL,
  `updated_at` integer DEFAULT (cast(strftime('%s','now') as integer) * 1000) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS `idx_affiliate_withdraw_user` ON `affiliate_withdraw` (`user_id`, `status`);
