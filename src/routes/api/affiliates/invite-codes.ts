import { createFileRoute } from '@tanstack/react-router';
import { affiliateRouteUser } from '@/server/affiliates';

import {
  createInviteCode,
  deleteInviteCode,
  findAffiliateUserByUserId,
  getRewardRule,
  isAffiliateApproved,
  listInviteCodes,
  setDefaultInviteCode,
  updateInviteCode,
} from '@/modules/affiliates/service';
import { respData, respErr } from '@/lib/resp';

/** The affiliate's invite links. */
async function GET({ request }: { request: Request }) {
  const gate = await affiliateRouteUser(request);
  if ('response' in gate) return gate.response;
  const userId = gate.user.id;
  try {
    const [affiliate, inviteCodes, rule] = await Promise.all([
      findAffiliateUserByUserId(userId),
      listInviteCodes({ userId }),
      getRewardRule(),
    ]);
    return respData({
      inviteParam: rule.inviteParam,
      affiliate: affiliate
        ? { approved: isAffiliateApproved(affiliate) }
        : null,
      inviteCodes,
    });
  } catch (error) {
    console.error('list invite codes failed', error);
    return respErr('Internal error');
  }
}

async function POST({ request }: { request: Request }) {
  const gate = await affiliateRouteUser(request, { rateLimitMs: 500 });
  if ('response' in gate) return gate.response;
  try {
    const body = await request.json().catch(() => ({}));
    const result = await createInviteCode({
      userId: gate.user.id,
      inviteCode: String(body.inviteCode || ''),
    });
    if (!result.ok) return respErr(result.error || 'save_failed');
    return respData({ ok: true });
  } catch (error) {
    console.error('create invite code failed', error);
    return respErr('Internal error');
  }
}

/** Edit a link's code, or `setDefault: true`. */
async function PUT({ request }: { request: Request }) {
  const gate = await affiliateRouteUser(request, { rateLimitMs: 500 });
  if ('response' in gate) return gate.response;
  try {
    const body = await request.json().catch(() => ({}));
    const id = String(body.id || '');
    if (!id) return respErr('id_required');
    const result = body.setDefault
      ? await setDefaultInviteCode({ userId: gate.user.id, id })
      : await updateInviteCode({
          userId: gate.user.id,
          id,
          inviteCode:
            body.inviteCode === undefined ? undefined : String(body.inviteCode),
        });
    if (!result.ok) return respErr(result.error || 'save_failed');
    return respData({ ok: true });
  } catch (error) {
    console.error('update invite code failed', error);
    return respErr('Internal error');
  }
}

async function DELETE({ request }: { request: Request }) {
  const gate = await affiliateRouteUser(request, { rateLimitMs: 500 });
  if ('response' in gate) return gate.response;
  try {
    const id = new URL(request.url).searchParams.get('id') || '';
    if (!id) return respErr('id_required');
    const result = await deleteInviteCode({ userId: gate.user.id, id });
    if (!result.ok) return respErr(result.error || 'delete_failed');
    return respData({ ok: true });
  } catch (error) {
    console.error('delete invite code failed', error);
    return respErr('Internal error');
  }
}

export const Route = createFileRoute('/api/affiliates/invite-codes')({
  server: { handlers: { GET, POST, PUT, DELETE } },
});
