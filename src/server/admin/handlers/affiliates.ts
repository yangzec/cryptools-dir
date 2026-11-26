import {
  createRewardForInvite,
  getAffiliateDetailAdmin,
  getInvites,
  getInvitesCount,
  getRewards,
  getRewardsCount,
  getWithdraws,
  getWithdrawsCount,
  listAffiliateStatisticsAdmin,
  listAffiliateUsersAdmin,
  listInvitesAdmin,
  listRewardsAdmin,
  listWithdrawsAdmin,
  updateAffiliateUser,
  updateAffiliateWithdraw,
} from '@/modules/affiliates/service';
import { respData, respErr, respOk, respPage } from '@/lib/resp';

import type { AdminHandlerContext } from '../types';

function listParams(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const value = (key: string) => {
    const v = searchParams.get(key)?.trim();
    return v && v !== 'all' ? v : undefined;
  };
  return {
    value,
    page: Math.max(1, parseInt(searchParams.get('page') || '1') || 1),
    limit: Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('pageSize') || '20') || 20)
    ),
    search: value('search'),
  };
}

const fail = (error: unknown) => {
  console.error('[admin/affiliates]', error);
  return respErr('Internal error');
};

export async function LIST({ request }: AdminHandlerContext) {
  try {
    const { value, page, limit, search } = listParams(request);
    const { items, total } = await listAffiliateUsersAdmin({
      search,
      status: value('status'),
      page,
      limit,
    });
    return respPage(items, total);
  } catch (error) {
    return fail(error);
  }
}

export async function UPDATE({ request }: AdminHandlerContext) {
  try {
    const body = (await request.json()) as {
      id: string;
      status?: string;
      commissionPercent?: number;
    };
    const result = await updateAffiliateUser(body.id, {
      status: body.status,
      commissionPercent: body.commissionPercent,
    });
    if (!result.ok) return respErr(result.error || 'update_failed');
    return respOk();
  } catch (error) {
    return fail(error);
  }
}

export async function DETAIL({ request }: AdminHandlerContext) {
  try {
    const { value, page, limit, search } = listParams(request);
    const userId = value('userId');
    if (!userId) return respErr('userId is required');
    const kind = value('kind') || 'summary';
    if (kind === 'invites') {
      const [items, total] = await Promise.all([
        getInvites({ userId, search, page, limit }),
        getInvitesCount({ userId, search }),
      ]);
      return respPage(items, total);
    }
    if (kind === 'rewards') {
      const [items, total] = await Promise.all([
        getRewards({ userId, search, page, limit }),
        getRewardsCount({ userId, search }),
      ]);
      return respPage(items, total);
    }
    if (kind === 'withdraws') {
      const [items, total] = await Promise.all([
        getWithdraws({ userId, search, page, limit }),
        getWithdrawsCount({ userId, search }),
      ]);
      return respPage(items, total);
    }
    return respData(await getAffiliateDetailAdmin(userId));
  } catch (error) {
    return fail(error);
  }
}

export async function INVITES({ request }: AdminHandlerContext) {
  try {
    const { value, page, limit, search } = listParams(request);
    const { items, total } = await listInvitesAdmin({
      search,
      paid: value('status'),
      page,
      limit,
    });
    return respPage(items, total);
  } catch (error) {
    return fail(error);
  }
}

export async function REWARDS({ request }: AdminHandlerContext) {
  try {
    const { value, page, limit, search } = listParams(request);
    const { items, total } = await listRewardsAdmin({
      search,
      rewardType: value('rewardType'),
      status: value('status'),
      page,
      limit,
    });
    return respPage(items, total);
  } catch (error) {
    return fail(error);
  }
}

export async function CREATE_REWARD({ request }: AdminHandlerContext) {
  try {
    const body = (await request.json()) as {
      inviteId: string;
      rewardType: 'fixed' | 'percent';
      amount?: number;
      percent?: number;
    };
    const result = await createRewardForInvite(body.inviteId, {
      rewardType: body.rewardType,
      amount: body.amount,
      percent: body.percent,
    });
    if (!result.ok) return respErr(result.error || 'create_failed');
    return respOk();
  } catch (error) {
    return fail(error);
  }
}

export async function WITHDRAWS({ request }: AdminHandlerContext) {
  try {
    const { value, page, limit, search } = listParams(request);
    const { items, total } = await listWithdrawsAdmin({
      search,
      status: value('status'),
      page,
      limit,
    });
    return respPage(items, total);
  } catch (error) {
    return fail(error);
  }
}

export async function UPDATE_WITHDRAW({ request }: AdminHandlerContext) {
  try {
    const body = (await request.json()) as {
      id: string;
      status?: string;
      remark?: string;
    };
    const result = await updateAffiliateWithdraw(body.id, {
      status: body.status,
      remark: body.remark?.trim(),
    });
    if (!result.ok) return respErr(result.error || 'update_failed');
    return respOk();
  } catch (error) {
    return fail(error);
  }
}

export async function STATISTICS({ request }: AdminHandlerContext) {
  try {
    const { value, page, limit, search } = listParams(request);
    const sortBy = value('sortBy') as
      | 'inviteCount'
      | 'paidRate'
      | 'rewardAmount'
      | 'withdrawAmount'
      | undefined;
    const timeRange = value('timeRange') as
      'all' | '24h' | '7d' | '30d' | undefined;
    const result = await listAffiliateStatisticsAdmin({
      sortBy,
      currency: (value('currency') || 'ALL').toUpperCase(),
      timeRange: timeRange || 'all',
      search: search || '',
      page,
      limit,
    });
    return respData(result);
  } catch (error) {
    console.error('[admin/affiliates] statistics', error);
    return respErr('Unable to load affiliate statistics');
  }
}
