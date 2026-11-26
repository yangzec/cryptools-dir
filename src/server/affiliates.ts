import { getAuth } from '@/core/auth';
import {
  AFFILIATE_INVITE_CODE_PATTERN,
  AFFILIATE_INVITE_COOKIE,
  getAffiliateRewardRule,
} from '@/config/affiliates';
import { isUserFeatureOn } from '@/config/user-features';
import {
  findAffiliateUserByInviteCode,
  isAffiliateApproved,
} from '@/modules/affiliates/service';
import { getAllConfigs } from '@/modules/config/service';
import { getCookieFromHeader } from '@/lib/cookie';
import { enforceMinIntervalRateLimit } from '@/lib/rate-limit';
import { respErr } from '@/lib/resp';

import { userFeatureEnabled } from './user-features';

/** The invite code a visitor clicked (cookie set by src/server.ts), if valid. */
export function inviteCodeFromRequest(request: Request): string {
  let value =
    getCookieFromHeader(
      request.headers.get('cookie'),
      AFFILIATE_INVITE_COOKIE
    ) || '';
  try {
    value = decodeURIComponent(value);
  } catch {
    return '';
  }
  return AFFILIATE_INVITE_CODE_PATTERN.test(value) ? value : '';
}

/**
 * The URL parameter that carries an invite code (admin setting, default
 * `ref`), or null while the program is off.
 */
export async function activeInviteParam(): Promise<string | null> {
  try {
    const configs = await getAllConfigs();
    if (!isUserFeatureOn(configs, 'affiliates_enabled')) return null;
    return getAffiliateRewardRule(configs).inviteParam;
  } catch {
    return null;
  }
}

/**
 * Whether a visitor's `?<param>=<code>` is a real invite: an approved
 * affiliate's code. Other values (e.g. `?ref=producthunt`) must not replace
 * an invite the visitor already clicked.
 */
export async function isLiveInviteCode(code: string): Promise<boolean> {
  if (!AFFILIATE_INVITE_CODE_PATTERN.test(code)) return false;
  try {
    return isAffiliateApproved(await findAffiliateUserByInviteCode(code));
  } catch {
    return false;
  }
}

/**
 * Common gate for /api/affiliates/* user routes: the program is on and the
 * caller is signed in. Returns the user, or the error response to send.
 */
export async function affiliateRouteUser(
  request: Request,
  { rateLimitMs }: { rateLimitMs?: number } = {}
): Promise<
  { user: { id: string; email: string; name: string } } | { response: Response }
> {
  if (rateLimitMs) {
    const limited = enforceMinIntervalRateLimit(request, {
      intervalMs: rateLimitMs,
      keyPrefix: 'affiliates',
    });
    if (limited) return { response: limited };
  }
  if (!(await userFeatureEnabled('affiliates_enabled')))
    return { response: respErr('Affiliate program is not available') };
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session?.user) return { response: respErr('Unauthorized') };
  if (rateLimitMs) {
    const limited = enforceMinIntervalRateLimit(request, {
      intervalMs: rateLimitMs,
      keyPrefix: 'affiliates',
      extraKey: session.user.id,
    });
    if (limited) return { response: limited };
  }
  return { user: session.user };
}
