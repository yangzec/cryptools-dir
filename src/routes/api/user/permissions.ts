import { createFileRoute } from '@tanstack/react-router';

import { getAuth } from '@/core/auth';
import { getUserPermissionCodes, hasPermission } from '@/modules/rbac/service';
import { respData, respErr } from '@/lib/resp';

async function GET({ request }: { request: Request }) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');

    const isAdmin = await hasPermission(session.user.id, 'admin.*');
    // Admins also get their codes, so admin pages can hide actions they
    // can't take (the API still enforces each one).
    const permissions = isAdmin
      ? await getUserPermissionCodes(session.user.id)
      : undefined;
    return respData({ isAdmin, permissions });
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

export const Route = createFileRoute('/api/user/permissions')({
  server: {
    handlers: { GET },
  },
});
