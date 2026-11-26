import * as affiliates from './handlers/affiliates';
import * as analytics_funnel from './handlers/analytics-funnel';
import * as analytics_overview from './handlers/analytics-overview';
import * as analytics_report from './handlers/analytics-report';
import * as categories from './handlers/categories';
import * as config from './handlers/config';
import * as config_custom from './handlers/config-custom';
import * as credits from './handlers/credits';
import * as directory_ads from './handlers/directory-ads';
import * as directory_categories from './handlers/directory-categories';
import * as directory_collections from './handlers/directory-collections';
import * as directory_tags from './handlers/directory-tags';
import * as directory_tools from './handlers/directory-tools';
import * as guest_posts from './handlers/guest-posts';
import * as guest_posts_id from './handlers/guest-posts-id';
import * as invite_codes from './handlers/invite-codes';
import * as orders from './handlers/orders';
import * as orders_refund from './handlers/orders-refund';
import * as permissions from './handlers/permissions';
import * as posts from './handlers/posts';
import * as roles_assign from './handlers/roles-assign';
import * as roles_index from './handlers/roles-index';
import * as roles_permissions from './handlers/roles-permissions';
import * as settings_test from './handlers/settings-test';
import * as subscriptions from './handlers/subscriptions';
import * as tickets from './handlers/tickets';
import * as tickets_id from './handlers/tickets-id';
import * as users_credits from './handlers/users-credits';
import * as users_id from './handlers/users-id';
import * as users_index from './handlers/users-index';
import * as users_password from './handlers/users-password';
import * as users_sources from './handlers/users-sources';
import * as users_timeline from './handlers/users-timeline';
import type { AdminHandlerContext } from './types';

export const handlers: Record<
  string,
  (context: AdminHandlerContext) => Promise<Response>
> = {
  users_list: users_index.GET,
  users_get: users_id.GET,
  users_sources: users_sources.GET,
  users_timeline: users_timeline.GET,
  users_set_password: users_password.POST,
  credits_adjust: users_credits.POST,
  orders_list: orders.GET,
  orders_update: orders.PATCH,
  orders_refund: orders_refund.POST,
  subscriptions_list: subscriptions.GET,
  analytics_funnel: analytics_funnel.GET,
  analytics_overview: analytics_overview.GET,
  analytics_report: analytics_report.GET,
  credits_list: credits.GET,
  categories_list: categories.GET,
  categories_create: categories.POST,
  categories_update: categories.PUT,
  categories_delete: categories.DELETE,
  directory_categories_list: directory_categories.GET,
  directory_categories_create: directory_categories.POST,
  directory_categories_update: directory_categories.PUT,
  directory_categories_delete: directory_categories.DELETE,
  directory_tags_list: directory_tags.GET,
  directory_tags_create: directory_tags.POST,
  directory_tags_update: directory_tags.PUT,
  directory_tags_delete: directory_tags.DELETE,
  directory_tools_list: directory_tools.GET,
  directory_tools_create: directory_tools.POST,
  directory_tools_update: directory_tools.PUT,
  directory_tools_delete: directory_tools.DELETE,
  directory_ads_list: directory_ads.GET,
  directory_ads_update: directory_ads.PUT,
  directory_ads_delete: directory_ads.DELETE,
  directory_collections_list: directory_collections.GET,
  directory_collections_create: directory_collections.POST,
  directory_collections_update: directory_collections.PUT,
  directory_collections_delete: directory_collections.DELETE,
  posts_list: posts.GET,
  posts_create: posts.POST,
  posts_update: posts.PUT,
  posts_delete: posts.DELETE,
  invite_codes_list: invite_codes.GET,
  invite_codes_create: invite_codes.POST,
  invite_codes_delete: invite_codes.DELETE,
  permissions_list: permissions.GET,
  permissions_create: permissions.POST,
  permissions_update: permissions.PUT,
  permissions_delete: permissions.DELETE,
  roles_list: roles_index.GET,
  roles_create: roles_index.POST,
  roles_update: roles_index.PUT,
  roles_delete: roles_index.DELETE,
  roles_assign: roles_assign.POST,
  roles_unassign: roles_assign.DELETE,
  roles_permissions_get: roles_permissions.GET,
  roles_permissions_update: roles_permissions.PUT,
  guest_posts_list: guest_posts.GET,
  guest_posts_get: guest_posts_id.GET,
  guest_posts_review: guest_posts_id.POST,
  guest_posts_reject: guest_posts_id.REJECT,
  guest_posts_update: guest_posts_id.PUT,
  guest_posts_unpublish: guest_posts_id.PATCH,
  guest_posts_restore: guest_posts_id.RESTORE,
  tickets_list: tickets.GET,
  tickets_get: tickets_id.GET,
  tickets_reply: tickets_id.POST,
  tickets_update: tickets_id.PATCH,
  settings_get: config.GET,
  settings_update: config.POST,
  custom_settings_get: config_custom.GET,
  custom_settings_replace: config_custom.POST,
  settings_test: settings_test.POST,
  affiliates_list: affiliates.LIST,
  affiliates_update: affiliates.UPDATE,
  affiliates_detail: affiliates.DETAIL,
  affiliates_invites_list: affiliates.INVITES,
  affiliates_rewards_list: affiliates.REWARDS,
  affiliates_rewards_create: affiliates.CREATE_REWARD,
  affiliates_withdraws_list: affiliates.WITHDRAWS,
  affiliates_withdraws_update: affiliates.UPDATE_WITHDRAW,
  affiliates_statistics: affiliates.STATISTICS,
};
