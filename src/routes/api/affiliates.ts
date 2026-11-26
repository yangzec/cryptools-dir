import { createFileRoute } from '@tanstack/react-router';
import { affiliateRouteUser } from '@/server/affiliates';

import { getAffiliateCommissionPercent } from '@/config/affiliates';
import {
  ensureDefaultInviteCode,
  findAffiliateUserByUserId,
  getInvites,
  getInvitesCount,
  getRewardDetail,
  getRewardRule,
  getRewards,
  getRewardsCount,
  getWithdraws,
  getWithdrawsCount,
  isAffiliateApproved,
  listInviteCodes,
} from '@/modules/affiliates/service';
import { respData, respErr } from '@/lib/resp';

const PAGE_SIZE = 10;

// The signed-in user's affiliate dashboard: membership, totals, and one page
// of invites / rewards / withdrawals (`tab`).
async function GET({ request }: { request: Request }) {
  const gate = await affiliateRouteUser(request);
  if ('response' in gate) return gate.response;
  const userId = gate.user.id;

  try {
    const { searchParams } = new URL(request.url);
    const tab = searchParams.get('tab') || 'invite';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
    const statusParam = searchParams.get('status');
    const status =
      statusParam && statusParam !== 'all' ? statusParam : undefined;
    const search = searchParams.get('keyword')?.trim() || undefined;

    const affiliate = await findAffiliateUserByUserId(userId);
    const approved = isAffiliateApproved(affiliate);
    if (approved) await ensureDefaultInviteCode(userId);

    const [rule, rewardDetail, inviteCodes] = await Promise.all([
      getRewardRule(),
      getRewardDetail({ userId }),
      approved ? listInviteCodes({ userId }) : [],
    ]);
    const defaultInviteCode = inviteCodes[0];

    let items: unknown[] = [];
    let total = 0;
    if (tab === 'reward') {
      [items, total] = await Promise.all([
        getRewards({ userId, status, search, page, limit: PAGE_SIZE }),
        getRewardsCount({ userId, status, search }),
      ]);
    } else if (tab === 'withdraw') {
      [items, total] = await Promise.all([
        getWithdraws({ userId, status, search, page, limit: PAGE_SIZE }),
        getWithdrawsCount({ userId, status, search }),
      ]);
    } else {
      [items, total] = await Promise.all([
        getInvites({ userId, search, page, limit: PAGE_SIZE }),
        getInvitesCount({ userId, search }),
      ]);
    }

    return respData({
      items,
      total,
      rewardDetail,
      rewardRule: rule,
      affiliateUser: affiliate
        ? {
            status: affiliate.status,
            approved,
            applyReason: affiliate.applyReason,
            // This affiliate's rate (their own or the rule's).
            commissionPercent: getAffiliateCommissionPercent(affiliate, rule),
            inviteCode: defaultInviteCode?.code ?? null,
            inviteCodeCount: inviteCodes.length,
          }
        : null,
    });
  } catch (error: any) {
    console.error('affiliates dashboard failed', error);
    return respErr('Internal error');
  }
}

export const Route = createFileRoute('/api/affiliates')({
  server: { handlers: { GET } },
});
