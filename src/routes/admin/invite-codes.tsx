import { createFileRoute } from '@tanstack/react-router';

import { InviteCodesPage } from './-invite-codes-page';

export const Route = createFileRoute('/admin/invite-codes')({
  component: InviteCodesPage,
});
