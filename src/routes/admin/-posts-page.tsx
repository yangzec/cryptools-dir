import { useEffect, useState } from 'react';
import { useForm } from '@tanstack/react-form';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { tDynamic } from '@/core/i18n/dynamic';
import {
  apiDelete,
  apiGet,
  apiPost,
  apiPut,
  pageQuery,
  type PageResult,
} from '@/lib/api-client';
import { formatDateTime } from '@/lib/time';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { DataTable, type Column } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

import { PostsEditDeleteDialogs } from './-posts-dialogs';
import { renderPostFields } from './-posts-fields';
import {
  emptyForm,
  PAGE_SIZE,
  postSchema,
  TABS,
  type CategoryOption,
  type Post,
  type PostForm,
  type Tab,
} from './-posts-shared';

export function PostsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [deletingPost, setDeletingPost] = useState<Post | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [tab, debouncedSearch]);

  const categoriesQuery = useQuery({
    queryKey: ['admin-categories', 'options'],
    queryFn: () => apiGet<CategoryOption[]>('/api/admin/categories?all=true'),
  });
  const categoryOptions = categoriesQuery.data ?? [];

  const listQuery = useQuery({
    queryKey: ['admin-posts', page, tab, debouncedSearch],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (tab !== 'all') params.set('status', tab);
      if (debouncedSearch) params.set('search', debouncedSearch);
      return apiGet<PageResult<Post>>(`/api/admin/posts?${params}`);
    },
    placeholderData: keepPreviousData,
  });

  const createForm = useForm({
    defaultValues: emptyForm,
    validators: { onSubmit: postSchema },
    onSubmit: async ({ value }) => {
      await createMutation.mutateAsync(value);
    },
  });

  const editForm = useForm({
    defaultValues: emptyForm,
    validators: { onSubmit: postSchema },
    onSubmit: async ({ value }) => {
      if (!editingPost) return;
      const body: Record<string, unknown> = { id: editingPost.id, ...value };
      if (!body.content) delete body.content; // don't overwrite content if empty
      await editMutation.mutateAsync(body);
    },
  });

  const createMutation = useMutation({
    mutationFn: (value: PostForm) => apiPost('/api/admin/posts', value),
    onSuccess: () => {
      toast.success(m['admin.posts.created']());
      setCreateOpen(false);
      createForm.reset();
      queryClient.invalidateQueries({ queryKey: ['admin-posts'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiPut('/api/admin/posts', body),
    onSuccess: () => {
      toast.success(m['admin.posts.updated']());
      setEditingPost(null);
      editForm.reset();
      queryClient.invalidateQueries({ queryKey: ['admin-posts'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/admin/posts?id=${id}`),
    onSuccess: () => {
      toast.success(m['admin.posts.deleted']());
      setDeletingPost(null);
      queryClient.invalidateQueries({ queryKey: ['admin-posts'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Reset AFTER the edit Dialog mounts fields (Base UI unmounts while closed).
  useEffect(() => {
    if (!editingPost) return;
    const id = editingPost.id;
    editForm.reset({
      slug: editingPost.slug,
      title: editingPost.title,
      description: editingPost.description || '',
      content: '',
      categories: editingPost.categories || '',
      authorName: editingPost.authorName || '',
      status: editingPost.status,
    });
    // list endpoint omits content — load it for the editor
    let cancelled = false;
    apiGet<Post & { content: string | null }>(`/api/admin/posts?id=${id}`)
      .then((post) => {
        if (!cancelled) {
          editForm.setFieldValue('content', post.content || '');
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [editingPost]);

  function openEdit(p: Post) {
    setEditingPost(p);
  }

  const statusVariant = (s: string) => {
    if (s === 'published') return 'default' as const;
    if (s === 'draft') return 'secondary' as const;
    return 'outline' as const;
  };

  const columns: Column<Post>[] = [
    {
      header: m['admin.posts.title_col'](),
      cell: (p) => <span className="font-medium">{p.title}</span>,
    },
    {
      header: m['admin.posts.slug_col'](),
      cell: (p) => <span className="font-mono text-xs">{p.slug}</span>,
    },
    { header: m['admin.posts.author_col'](), cell: (p) => p.authorName || '—' },
    {
      header: m['admin.posts.status_col'](),
      cell: (p) => <Badge variant={statusVariant(p.status)}>{p.status}</Badge>,
    },
    {
      header: m['admin.posts.created_at'](),
      cell: (p) => (
        <span className="text-muted-foreground text-sm">
          {formatDateTime(p.createdAt)}
        </span>
      ),
    },
    {
      header: m['admin.posts.actions_col'](),
      className: 'w-[80px]',
      cell: (p) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => openEdit(p)}
          >
            <Pencil className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => setDeletingPost(p)}
          >
            <Trash2 className="size-3" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{m['admin.posts.title']()}</h1>
          <p className="text-muted-foreground">
            {m['admin.posts.description']()}
          </p>
        </div>
        <Dialog
          open={createOpen}
          onOpenChange={(v) => {
            setCreateOpen(v);
            if (v) createForm.reset({ ...emptyForm });
          }}
        >
          <DialogTrigger className="bg-primary text-primary-foreground hover:bg-primary/80 inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-colors">
            <Plus className="size-4" />
            {m['admin.posts.create']()}
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{m['admin.posts.create_title']()}</DialogTitle>
              <DialogDescription>
                {m['admin.posts.create_description']()}
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                createForm.handleSubmit();
              }}
            >
              {renderPostFields(createForm, categoryOptions)}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                >
                  {m['admin.posts.cancel']()}
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {m['admin.posts.save']()}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border-border flex gap-1 overflow-x-auto overflow-y-hidden border-b">
        {TABS.map((tb) => (
          <button
            key={tb}
            onClick={() => setTab(tb)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors',
              tab === tb
                ? 'border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground border-transparent'
            )}
          >
            {tDynamic(`admin.posts.tab_${tb}`)}
          </button>
        ))}
      </div>

      <Card>
        <CardContent>
          <DataTable
            columns={columns}
            data={listQuery.data?.items ?? []}
            total={listQuery.data?.total ?? 0}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            rowKey={(p) => p.id}
            emptyText={m['admin.posts.no_data']()}
            search={search}
            onSearchChange={setSearch}
            onRefresh={() => listQuery.refetch()}
            loading={listQuery.isFetching || listQuery.isPending}
          />
        </CardContent>
      </Card>

      <PostsEditDeleteDialogs
        editingPost={editingPost}
        setEditingPost={setEditingPost}
        deletingPost={deletingPost}
        setDeletingPost={setDeletingPost}
        editForm={editForm}
        editMutation={editMutation}
        deleteMutation={deleteMutation}
        renderFields={(form) => renderPostFields(form, categoryOptions)}
      />
    </div>
  );
}
