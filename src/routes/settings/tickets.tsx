import { createFileRoute } from '@tanstack/react-router';

import { FeatureGate } from './-feature-gate';
import { TicketsPage } from './-tickets-page';

export const Route = createFileRoute('/settings/tickets')({
  component: () => (
    <FeatureGate feature="tickets">
      <TicketsPage />
    </FeatureGate>
  ),
});
