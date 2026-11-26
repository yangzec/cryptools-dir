import { createFileRoute } from '@tanstack/react-router';

import { PostsPage } from './-posts-page';

export const Route = createFileRoute('/admin/posts')({
  component: PostsPage,
});
