import { createServerFn } from '@tanstack/react-start';

/**
 * Server function to fetch homepage data from database
 */
export const getHomepageDataFn = createServerFn()
  .validator((data: { locale: string }) => data)
  .handler(async ({ data }) => {
    try {
      const { getHomepageData } = await import('./service');
      return await getHomepageData(data.locale);
    } catch (err: any) {
      console.error('[getHomepageDataFn Error]', err);
      return null;
    }
  });

/**
 * Server function to fetch directory tools with filtering & pagination
 */
export const getDirectoryToolsFn = createServerFn()
  .validator(
    (data: {
      locale: string;
      category?: string;
      tag?: string;
      collection?: string;
      sort?: string;
      page?: number;
      pageSize?: number;
    }) => data
  )
  .handler(async ({ data }) => {
    try {
      const { getDirectoryTools, getDirectoryCategories } =
        await import('./service');
      const [toolsResult, categories] = await Promise.all([
        getDirectoryTools({
          locale: data.locale,
          categorySlug: data.category,
          tagSlug: data.tag,
          collectionSlug: data.collection,
          sort: data.sort,
          page: data.page,
          pageSize: data.pageSize,
        }),
        getDirectoryCategories(data.locale),
      ]);
      return {
        ...toolsResult,
        categories,
      };
    } catch (err: any) {
      console.error('[getDirectoryToolsFn Error]', err);
      return { items: [], total: 0, page: 1, pageSize: 24, categories: [] };
    }
  });

/**
 * Server function to fetch all categories
 */
export const getDirectoryCategoriesFn = createServerFn()
  .validator((data: { locale: string }) => data)
  .handler(async ({ data }) => {
    try {
      const { getDirectoryCategories } = await import('./service');
      return await getDirectoryCategories(data.locale);
    } catch (err: any) {
      console.error('[getDirectoryCategoriesFn Error]', err);
      return [];
    }
  });

/**
 * Server function to fetch all tags
 */
export const getDirectoryTagsFn = createServerFn()
  .validator((data: { locale: string }) => data)
  .handler(async ({ data }) => {
    try {
      const { getDirectoryTags } = await import('./service');
      return await getDirectoryTags(data.locale);
    } catch (err: any) {
      console.error('[getDirectoryTagsFn Error]', err);
      return [];
    }
  });

/**
 * Server function to fetch all collections
 */
export const getDirectoryCollectionsFn = createServerFn()
  .validator((data: { locale: string }) => data)
  .handler(async ({ data }) => {
    try {
      const { getDirectoryCollections } = await import('./service');
      return await getDirectoryCollections(data.locale);
    } catch (err: any) {
      console.error('[getDirectoryCollectionsFn Error]', err);
      return [];
    }
  });

/**
 * Server function to fetch a single collection by slug
 */
export const getDirectoryCollectionBySlugFn = createServerFn()
  .validator((data: { locale: string; slug: string }) => data)
  .handler(async ({ data }) => {
    try {
      const { getDirectoryCollectionBySlug } = await import('./service');
      return await getDirectoryCollectionBySlug(data.slug, data.locale);
    } catch (err: any) {
      console.error('[getDirectoryCollectionBySlugFn Error]', err);
      return null;
    }
  });

/**
 * Server function to fetch feed items
 */
export const getDirectoryFeedFn = createServerFn()
  .validator((data: { locale: string; type?: 'all' | 'community' }) => data)
  .handler(async ({ data }) => {
    try {
      const { getDirectoryFeed } = await import('./service');
      return await getDirectoryFeed({
        locale: data.locale,
        type: data.type,
      });
    } catch (err: any) {
      console.error('[getDirectoryFeedFn Error]', err);
      return { items: [] };
    }
  });

/**
 * Server function to fetch a single tool by slug
 */
export const getDirectoryToolBySlugFn = createServerFn()
  .validator((data: { locale: string; slug: string }) => data)
  .handler(async ({ data }) => {
    try {
      const { getDirectoryToolBySlug } = await import('./service');
      return await getDirectoryToolBySlug(data.slug, data.locale);
    } catch (err: any) {
      console.error('[getDirectoryToolBySlugFn Error]', err);
      return null;
    }
  });

/**
 * Unpublished (or any-status) tool for its submitter or an admin. Null for
 * anyone else so /tools/$slug?preview=1 404s like guest-post preview.
 */
export const getDirectoryToolPreviewFn = createServerFn()
  .validator((data: { locale: string; slug: string }) => data)
  .handler(async ({ data }) => {
    try {
      const { getRequest } = await import('@tanstack/react-start/server');
      const { getAuth } = await import('@/core/auth');
      const session = await getAuth().api.getSession({
        headers: getRequest().headers,
      });
      if (!session?.user) return null;

      const { getDirectoryToolAuthMeta, getDirectoryToolBySlug } =
        await import('./service');
      const meta = await getDirectoryToolAuthMeta(data.slug);
      if (!meta) return null;

      const isAuthor = meta.submittedBy === session.user.id;
      if (!isAuthor) {
        const { hasPermission } = await import('@/modules/rbac/service');
        if (!(await hasPermission(session.user.id, 'admin.*'))) return null;
      }

      const tool = await getDirectoryToolBySlug(data.slug, data.locale, {
        anyStatus: true,
      });
      if (!tool) return null;

      return {
        tool,
        preview: meta.status !== 'published',
        previewInfo: {
          toolId: meta.id,
          status: meta.status as
            | 'published'
            | 'pending'
            | 'pending_payment'
            | 'rejected',
          isAuthor,
        },
      };
    } catch (err: any) {
      console.error('[getDirectoryToolPreviewFn Error]', err);
      return null;
    }
  });

async function requireSessionUser() {
  const { getRequest } = await import('@tanstack/react-start/server');
  const { getAuth } = await import('@/core/auth');
  const session = await getAuth().api.getSession({
    headers: getRequest().headers,
  });
  if (!session?.user?.id) return null;
  return session.user;
}

export const submitDirectoryToolFn = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      locale: string;
      name: string;
      websiteUrl: string;
      tagline: string;
      categoryId: string;
      description?: string;
      plan: 'free' | 'premium';
    }) => data
  )
  .handler(async ({ data }) => {
    try {
      const user = await requireSessionUser();
      if (!user) return { ok: false as const, error: 'unauthorized' };
      const { submitDirectoryTool } = await import('./user-actions');
      const result = await submitDirectoryTool({
        userId: user.id,
        authorName: user.name,
        ...data,
      });
      return { ok: true as const, ...result };
    } catch (err: any) {
      console.error('[submitDirectoryToolFn Error]', err);
      return {
        ok: false as const,
        error: err?.message || 'submit_failed',
      };
    }
  });

export const getMySubmissionsFn = createServerFn()
  .validator((data: { locale: string }) => data)
  .handler(async ({ data }) => {
    try {
      const user = await requireSessionUser();
      if (!user)
        return { ok: false as const, error: 'unauthorized', items: [] };
      const { listMySubmissions } = await import('./user-actions');
      const items = await listMySubmissions(user.id, data.locale);
      return { ok: true as const, items };
    } catch (err: any) {
      console.error('[getMySubmissionsFn Error]', err);
      return { ok: false as const, error: 'failed', items: [] };
    }
  });

export const createSponsorAdFn = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      name: string;
      tagline: string;
      url: string;
      iconUrl?: string;
      tier: 'silver' | 'gold' | 'platinum';
    }) => data
  )
  .handler(async ({ data }) => {
    try {
      const user = await requireSessionUser();
      if (!user) return { ok: false as const, error: 'unauthorized' };
      const { createSponsorAd } = await import('./user-actions');
      const result = await createSponsorAd({
        userId: user.id,
        ...data,
      });
      return { ok: true as const, ...result };
    } catch (err: any) {
      console.error('[createSponsorAdFn Error]', err);
      return {
        ok: false as const,
        error: err?.message || 'create_failed',
      };
    }
  });

export const getMySponsorAdsFn = createServerFn().handler(async () => {
  try {
    const user = await requireSessionUser();
    if (!user) return { ok: false as const, error: 'unauthorized', items: [] };
    const { listMySponsorAds } = await import('./user-actions');
    const items = await listMySponsorAds(user.id);
    return { ok: true as const, items };
  } catch (err: any) {
    console.error('[getMySponsorAdsFn Error]', err);
    return { ok: false as const, error: 'failed', items: [] };
  }
});

/** Cancel an unpaid sponsor booking and release the inventory hold. */
export const cancelPendingSponsorAdFn = createServerFn({ method: 'POST' })
  .validator((data: { adId: string }) => {
    const adId = typeof data?.adId === 'string' ? data.adId.trim() : '';
    if (!adId) throw new Error('adId required');
    return { adId };
  })
  .handler(async ({ data }) => {
    try {
      const user = await requireSessionUser();
      if (!user) return { ok: false as const, error: 'unauthorized' };
      const { cancelPendingSponsorAdPayment } = await import('./user-actions');
      const result = await cancelPendingSponsorAdPayment({
        userId: user.id,
        adId: data.adId,
      });
      return { ok: true as const, ...result };
    } catch (err: any) {
      console.error('[cancelPendingSponsorAdFn Error]', err);
      return {
        ok: false as const,
        error: err?.message || 'cancel_failed',
      };
    }
  });

export const getSponsorTierInventoryFn = createServerFn().handler(async () => {
  try {
    const { getSponsorTierInventory } = await import('./user-actions');
    return await getSponsorTierInventory();
  } catch (err: any) {
    console.error('[getSponsorTierInventoryFn Error]', err);
    return null;
  }
});

export const getActiveSponsorAdsFn = createServerFn()
  .validator(
    (data?: { limit?: number; placement?: 'listing' | 'detail' }) => data || {}
  )
  .handler(async ({ data }) => {
    try {
      const { getActiveSponsorAds } = await import('./service');
      return await getActiveSponsorAds(data?.limit ?? 6, {
        placement: data?.placement,
      });
    } catch (err: any) {
      console.error('[getActiveSponsorAdsFn Error]', err);
      return [];
    }
  });

export const getMyDirectoryStatsFn = createServerFn().handler(async () => {
  try {
    const user = await requireSessionUser();
    if (!user) {
      return {
        ok: false as const,
        error: 'unauthorized',
        submissions: 0,
        ads: 0,
      };
    }
    const { countMySubmissions, countMySponsorAds } =
      await import('./user-actions');
    const [submissions, ads] = await Promise.all([
      countMySubmissions(user.id),
      countMySponsorAds(user.id),
    ]);
    return { ok: true as const, submissions, ads };
  } catch (err: any) {
    console.error('[getMyDirectoryStatsFn Error]', err);
    return { ok: false as const, error: 'failed', submissions: 0, ads: 0 };
  }
});
