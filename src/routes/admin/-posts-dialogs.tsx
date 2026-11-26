import type { ReactNode } from 'react';

import { m } from '@/paraglide/messages.js';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import type { Post } from './-posts-shared';

export function PostsEditDeleteDialogs({
  editingPost,
  setEditingPost,
  deletingPost,
  setDeletingPost,
  editForm,
  editMutation,
  deleteMutation,
  renderFields,
}: {
  editingPost: Post | null;
  setEditingPost: (v: Post | null) => void;
  deletingPost: Post | null;
  setDeletingPost: (v: Post | null) => void;
  editForm: { handleSubmit: () => void };
  editMutation: { isPending: boolean };
  deleteMutation: { isPending: boolean; mutate: (id: string) => void };
  renderFields: (form: any) => ReactNode;
}) {
  return (
    <>
      <Dialog
        open={!!editingPost}
        onOpenChange={(v) => !v && setEditingPost(null)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{m['admin.posts.edit_title']()}</DialogTitle>
            <DialogDescription>
              {m['admin.posts.edit_description']()}
            </DialogDescription>
          </DialogHeader>
          <form
            key={editingPost?.id ?? 'edit'}
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              editForm.handleSubmit();
            }}
          >
            {renderFields(editForm)}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingPost(null)}
              >
                {m['admin.posts.cancel']()}
              </Button>
              <Button type="submit" disabled={editMutation.isPending}>
                {m['admin.posts.save']()}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deletingPost}
        onOpenChange={(v) => !v && setDeletingPost(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m['admin.posts.delete_title']()}</DialogTitle>
            <DialogDescription>
              {m['admin.posts.delete_confirm']()}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingPost(null)}>
              {m['admin.posts.cancel']()}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() =>
                deletingPost && deleteMutation.mutate(deletingPost.id)
              }
            >
              {m['admin.posts.confirm_delete']()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
