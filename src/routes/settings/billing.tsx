import { createFileRoute } from '@tanstack/react-router';

import { BillingPage } from './-billing-page';
import { FeatureGate } from './-feature-gate';

export const Route = createFileRoute('/settings/billing')({
  component: () => (
    <FeatureGate feature="billing">
      <BillingPage />
    </FeatureGate>
  ),
});
