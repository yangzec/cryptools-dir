import { createFileRoute } from '@tanstack/react-router';

import { AdminTicketsPage } from './-tickets-page';

export const Route = createFileRoute('/admin/tickets')({
  validateSearch: (search: Record<string, unknown>): { id?: string } =>
    typeof search.id === 'string' && search.id ? { id: search.id } : {},
  component: AdminTicketsPage,
});
