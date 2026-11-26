import { createFileRoute } from '@tanstack/react-router';

import { GuestPostEditorPage } from './-editor-page';

export const Route = createFileRoute('/settings/guest-posts/$id')({
  validateSearch: (search: Record<string, unknown>): { package?: string } =>
    typeof search.package === 'string' && search.package
      ? { package: search.package }
      : {},
  component: GuestPostEditorPage,
});
