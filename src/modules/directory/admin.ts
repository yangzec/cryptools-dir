import { and, asc, count, desc, eq, inArray, like, or } from 'drizzle-orm';

import { db } from '@/core/db';
import {
  directoryCategory,
  directoryCategoryTranslation,
  directoryCollection,
  directoryCollectionTool,
  directoryCollectionTranslation,
  directorySponsorAd,
  directoryTag,
  directoryTagTranslation,
  directoryTool,
  directoryToolTag,
  directoryToolTranslation,
  order,
} from '@/config/db/schema';
import { getUuid } from '@/lib/hash';

function slugify(input: string) {
  const base = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || `item-${Date.now().toString(36)}`;
}

async function ensureUniqueSlug(
  table:
    | typeof directoryTool
    | typeof directoryCategory
    | typeof directoryTag
    | typeof directoryCollection,
  slug: string,
  excludeId?: string
) {
  const base = slugify(slug);
  let candidate = base;
  for (let i = 0; i < 30; i++) {
    const rows = await db()
      .select({ id: table.id })
      .from(table)
      .where(eq(table.slug, candidate))
      .limit(1);
    const hit = rows[0];
    if (!hit || (excludeId && hit.id === excludeId)) return candidate;
    candidate = `${base}-${i + 2}`;
  }
  return `${base}-${getUuid().slice(0, 8)}`;
}

function parsePage(page?: number, pageSize?: number) {
  const p = Math.max(1, page || 1);
  const size = Math.min(100, Math.max(1, pageSize || 20));
  return { page: p, pageSize: size, offset: (p - 1) * size };
}

// ─── Categories ─────────────────────────────────────────────────────────────

export async function listDirectoryCategoriesAdmin(params: {
  page?: number;
  pageSize?: number;
  search?: string;
}) {
  const { page, pageSize, offset } = parsePage(params.page, params.pageSize);
  const search = params.search?.trim();

  const conditions = search
    ? or(
        like(directoryCategory.slug, `%${search}%`),
        like(directoryCategoryTranslation.name, `%${search}%`)
      )
    : undefined;

  const base = db()
    .select({
      id: directoryCategory.id,
      slug: directoryCategory.slug,
      icon: directoryCategory.icon,
      sort: directoryCategory.sort,
      status: directoryCategory.status,
      createdAt: directoryCategory.createdAt,
      name: directoryCategoryTranslation.name,
      description: directoryCategoryTranslation.description,
      locale: directoryCategoryTranslation.locale,
    })
    .from(directoryCategory)
    .leftJoin(
      directoryCategoryTranslation,
      and(
        eq(directoryCategoryTranslation.categoryId, directoryCategory.id),
        eq(directoryCategoryTranslation.locale, 'en')
      )
    );

  const rows = conditions
    ? await base
        .where(conditions)
        .orderBy(desc(directoryCategory.sort), asc(directoryCategory.slug))
        .limit(pageSize)
        .offset(offset)
    : await base
        .orderBy(desc(directoryCategory.sort), asc(directoryCategory.slug))
        .limit(pageSize)
        .offset(offset);

  const totalRow = conditions
    ? await db()
        .select({ total: count() })
        .from(directoryCategory)
        .leftJoin(
          directoryCategoryTranslation,
          and(
            eq(directoryCategoryTranslation.categoryId, directoryCategory.id),
            eq(directoryCategoryTranslation.locale, 'en')
          )
        )
        .where(conditions)
    : await db().select({ total: count() }).from(directoryCategory);

  const ids = rows.map((r: any) => r.id as string);
  const zhMap = new Map<string, { name: string; description: string | null }>();
  const toolCountMap = new Map<string, number>();
  if (ids.length > 0) {
    const zhAll = await db()
      .select({
        categoryId: directoryCategoryTranslation.categoryId,
        name: directoryCategoryTranslation.name,
        description: directoryCategoryTranslation.description,
      })
      .from(directoryCategoryTranslation)
      .where(eq(directoryCategoryTranslation.locale, 'zh'));
    for (const z of zhAll) {
      if (ids.includes(z.categoryId)) {
        zhMap.set(z.categoryId, {
          name: z.name,
          description: z.description,
        });
      }
    }

    const toolCounts = await db()
      .select({
        categoryId: directoryTool.categoryId,
        total: count(),
      })
      .from(directoryTool)
      .where(inArray(directoryTool.categoryId, ids))
      .groupBy(directoryTool.categoryId);
    for (const row of toolCounts) {
      if (row.categoryId) toolCountMap.set(row.categoryId, Number(row.total));
    }
  }

  return {
    items: rows.map((r: any) => ({
      id: r.id,
      slug: r.slug,
      icon: r.icon,
      sort: r.sort,
      status: r.status,
      name: r.name || r.slug,
      description: r.description,
      nameZh: zhMap.get(r.id)?.name || '',
      descriptionZh: zhMap.get(r.id)?.description || '',
      toolCount: toolCountMap.get(r.id) || 0,
      createdAt:
        r.createdAt instanceof Date
          ? r.createdAt.toISOString()
          : String(r.createdAt),
    })),
    total: Number(totalRow[0]?.total || 0),
    page,
    pageSize,
  };
}

export async function listDirectoryCategoryOptions() {
  const rows = await db()
    .select({
      id: directoryCategory.id,
      slug: directoryCategory.slug,
      name: directoryCategoryTranslation.name,
    })
    .from(directoryCategory)
    .leftJoin(
      directoryCategoryTranslation,
      and(
        eq(directoryCategoryTranslation.categoryId, directoryCategory.id),
        eq(directoryCategoryTranslation.locale, 'en')
      )
    )
    .orderBy(desc(directoryCategory.sort), asc(directoryCategory.slug));
  return rows.map((r: any) => ({
    id: r.id,
    slug: r.slug,
    name: r.name || r.slug,
  }));
}

async function upsertCategoryTranslation(
  categoryId: string,
  locale: string,
  name: string,
  description?: string | null
) {
  const existing = await db()
    .select({ id: directoryCategoryTranslation.id })
    .from(directoryCategoryTranslation)
    .where(
      and(
        eq(directoryCategoryTranslation.categoryId, categoryId),
        eq(directoryCategoryTranslation.locale, locale)
      )
    )
    .limit(1);

  if (existing[0]) {
    await db()
      .update(directoryCategoryTranslation)
      .set({
        name,
        description: description?.trim() ? description.trim() : null,
      })
      .where(eq(directoryCategoryTranslation.id, existing[0].id));
  } else {
    await db()
      .insert(directoryCategoryTranslation)
      .values({
        id: getUuid(),
        categoryId,
        locale,
        name,
        description: description?.trim() ? description.trim() : null,
      });
  }
}

export async function createDirectoryCategoryAdmin(input: {
  slug: string;
  name: string;
  description?: string;
  nameZh?: string;
  descriptionZh?: string;
  icon?: string;
  sort?: number;
  status?: string;
}) {
  const slug = await ensureUniqueSlug(
    directoryCategory,
    input.slug || input.name
  );
  const id = getUuid();
  await db()
    .insert(directoryCategory)
    .values({
      id,
      slug,
      icon: input.icon?.trim() || null,
      sort: input.sort ?? 0,
      status: input.status === 'draft' ? 'draft' : 'published',
    });
  await upsertCategoryTranslation(
    id,
    'en',
    input.name.trim(),
    input.description
  );
  if (input.nameZh?.trim()) {
    await upsertCategoryTranslation(
      id,
      'zh',
      input.nameZh.trim(),
      input.descriptionZh
    );
  }
  return { id, slug };
}

export async function updateDirectoryCategoryAdmin(
  id: string,
  input: {
    slug?: string;
    name?: string;
    description?: string;
    nameZh?: string;
    descriptionZh?: string;
    icon?: string;
    sort?: number;
    status?: string;
  }
) {
  const existing = await db()
    .select({ id: directoryCategory.id })
    .from(directoryCategory)
    .where(eq(directoryCategory.id, id))
    .limit(1);
  if (!existing[0]) throw new Error('Category not found');

  // Slug is immutable after create — public nav URLs depend on it.
  const patch: Record<string, unknown> = {};
  if (input.icon !== undefined) patch.icon = input.icon?.trim() || null;
  if (input.sort !== undefined) patch.sort = input.sort;
  if (input.status !== undefined) {
    const next = input.status === 'draft' ? 'draft' : 'published';
    if (next === 'draft') {
      const [{ total }] = await db()
        .select({ total: count() })
        .from(directoryTool)
        .where(eq(directoryTool.categoryId, id));
      if (Number(total) > 0) {
        throw new Error(
          'Category still has tools — reassign them before unpublishing'
        );
      }
    }
    patch.status = next;
  }
  if (Object.keys(patch).length) {
    await db()
      .update(directoryCategory)
      .set(patch)
      .where(eq(directoryCategory.id, id));
  }
  if (input.name?.trim()) {
    await upsertCategoryTranslation(
      id,
      'en',
      input.name.trim(),
      input.description
    );
  }
  if (input.nameZh !== undefined) {
    if (input.nameZh.trim()) {
      await upsertCategoryTranslation(
        id,
        'zh',
        input.nameZh.trim(),
        input.descriptionZh
      );
    } else {
      await db()
        .delete(directoryCategoryTranslation)
        .where(
          and(
            eq(directoryCategoryTranslation.categoryId, id),
            eq(directoryCategoryTranslation.locale, 'zh')
          )
        );
    }
  }
  return { id };
}

export async function deleteDirectoryCategoryAdmin(id: string) {
  const existing = await db()
    .select({ id: directoryCategory.id })
    .from(directoryCategory)
    .where(eq(directoryCategory.id, id))
    .limit(1);
  if (!existing[0]) throw new Error('Category not found');

  const [{ total }] = await db()
    .select({ total: count() })
    .from(directoryTool)
    .where(eq(directoryTool.categoryId, id));
  if (Number(total) > 0) {
    throw new Error('Category still has tools — reassign them first');
  }

  // D1/SQLite may not enforce FK cascades — clear children explicitly.
  await db()
    .delete(directoryCategoryTranslation)
    .where(eq(directoryCategoryTranslation.categoryId, id));
  await db().delete(directoryCategory).where(eq(directoryCategory.id, id));
}

// ─── Tags ───────────────────────────────────────────────────────────────────

export async function listDirectoryTagsAdmin(params: {
  page?: number;
  pageSize?: number;
  search?: string;
}) {
  const { page, pageSize, offset } = parsePage(params.page, params.pageSize);
  const search = params.search?.trim();
  const conditions = search
    ? or(
        like(directoryTag.slug, `%${search}%`),
        like(directoryTagTranslation.name, `%${search}%`)
      )
    : undefined;

  const base = db()
    .select({
      id: directoryTag.id,
      slug: directoryTag.slug,
      createdAt: directoryTag.createdAt,
      name: directoryTagTranslation.name,
      description: directoryTagTranslation.description,
    })
    .from(directoryTag)
    .leftJoin(
      directoryTagTranslation,
      and(
        eq(directoryTagTranslation.tagId, directoryTag.id),
        eq(directoryTagTranslation.locale, 'en')
      )
    );

  const rows = conditions
    ? await base
        .where(conditions)
        .orderBy(asc(directoryTag.slug))
        .limit(pageSize)
        .offset(offset)
    : await base.orderBy(asc(directoryTag.slug)).limit(pageSize).offset(offset);

  const totalRow = conditions
    ? await db()
        .select({ total: count() })
        .from(directoryTag)
        .leftJoin(
          directoryTagTranslation,
          and(
            eq(directoryTagTranslation.tagId, directoryTag.id),
            eq(directoryTagTranslation.locale, 'en')
          )
        )
        .where(conditions)
    : await db().select({ total: count() }).from(directoryTag);

  const ids = rows.map((r: any) => r.id as string);
  const zhMap = new Map<string, { name: string; description: string | null }>();
  const toolCountMap = new Map<string, number>();
  if (ids.length > 0) {
    const zhAll = await db()
      .select({
        tagId: directoryTagTranslation.tagId,
        name: directoryTagTranslation.name,
        description: directoryTagTranslation.description,
      })
      .from(directoryTagTranslation)
      .where(eq(directoryTagTranslation.locale, 'zh'));
    for (const z of zhAll) {
      if (ids.includes(z.tagId)) {
        zhMap.set(z.tagId, { name: z.name, description: z.description });
      }
    }

    const toolCounts = await db()
      .select({
        tagId: directoryToolTag.tagId,
        total: count(),
      })
      .from(directoryToolTag)
      .where(inArray(directoryToolTag.tagId, ids))
      .groupBy(directoryToolTag.tagId);
    for (const row of toolCounts) {
      toolCountMap.set(row.tagId, Number(row.total));
    }
  }

  return {
    items: rows.map((r: any) => ({
      id: r.id,
      slug: r.slug,
      name: r.name || r.slug,
      description: r.description,
      nameZh: zhMap.get(r.id)?.name || '',
      descriptionZh: zhMap.get(r.id)?.description || '',
      toolCount: toolCountMap.get(r.id) || 0,
      createdAt: r.createdAt?.toISOString?.() ?? String(r.createdAt),
    })),
    total: Number(totalRow[0]?.total || 0),
    page,
    pageSize,
  };
}

export async function listDirectoryTagOptions() {
  const rows = await db()
    .select({
      id: directoryTag.id,
      slug: directoryTag.slug,
      name: directoryTagTranslation.name,
    })
    .from(directoryTag)
    .leftJoin(
      directoryTagTranslation,
      and(
        eq(directoryTagTranslation.tagId, directoryTag.id),
        eq(directoryTagTranslation.locale, 'en')
      )
    )
    .orderBy(asc(directoryTag.slug));
  return rows.map((r: any) => ({
    id: r.id,
    slug: r.slug,
    name: r.name || r.slug,
  }));
}

async function upsertTagTranslation(
  tagId: string,
  locale: string,
  name: string,
  description?: string | null
) {
  const existing = await db()
    .select({ id: directoryTagTranslation.id })
    .from(directoryTagTranslation)
    .where(
      and(
        eq(directoryTagTranslation.tagId, tagId),
        eq(directoryTagTranslation.locale, locale)
      )
    )
    .limit(1);
  if (existing[0]) {
    await db()
      .update(directoryTagTranslation)
      .set({
        name,
        description: description?.trim() ? description.trim() : null,
      })
      .where(eq(directoryTagTranslation.id, existing[0].id));
  } else {
    await db()
      .insert(directoryTagTranslation)
      .values({
        id: getUuid(),
        tagId,
        locale,
        name,
        description: description?.trim() ? description.trim() : null,
      });
  }
}

export async function createDirectoryTagAdmin(input: {
  slug: string;
  name: string;
  description?: string;
  nameZh?: string;
  descriptionZh?: string;
}) {
  const slug = await ensureUniqueSlug(directoryTag, input.slug || input.name);
  const id = getUuid();
  await db().insert(directoryTag).values({ id, slug });
  await upsertTagTranslation(id, 'en', input.name.trim(), input.description);
  if (input.nameZh?.trim()) {
    await upsertTagTranslation(
      id,
      'zh',
      input.nameZh.trim(),
      input.descriptionZh
    );
  }
  return { id, slug };
}

export async function updateDirectoryTagAdmin(
  id: string,
  input: {
    slug?: string;
    name?: string;
    description?: string;
    nameZh?: string;
    descriptionZh?: string;
  }
) {
  const existing = await db()
    .select({ id: directoryTag.id })
    .from(directoryTag)
    .where(eq(directoryTag.id, id))
    .limit(1);
  if (!existing[0]) throw new Error('Tag not found');

  // Slug is immutable after create — public tag URLs depend on it.
  if (input.name?.trim()) {
    await upsertTagTranslation(id, 'en', input.name.trim(), input.description);
  }
  if (input.nameZh !== undefined) {
    if (input.nameZh.trim()) {
      await upsertTagTranslation(
        id,
        'zh',
        input.nameZh.trim(),
        input.descriptionZh
      );
    } else {
      await db()
        .delete(directoryTagTranslation)
        .where(
          and(
            eq(directoryTagTranslation.tagId, id),
            eq(directoryTagTranslation.locale, 'zh')
          )
        );
    }
  }
  return { id };
}

export async function deleteDirectoryTagAdmin(id: string) {
  const existing = await db()
    .select({ id: directoryTag.id })
    .from(directoryTag)
    .where(eq(directoryTag.id, id))
    .limit(1);
  if (!existing[0]) throw new Error('Tag not found');

  // Explicit cleanup: D1/SQLite may not enforce FK cascades.
  await db().delete(directoryToolTag).where(eq(directoryToolTag.tagId, id));
  await db()
    .delete(directoryTagTranslation)
    .where(eq(directoryTagTranslation.tagId, id));
  await db().delete(directoryTag).where(eq(directoryTag.id, id));
}

// ─── Tools ──────────────────────────────────────────────────────────────────

export async function listDirectoryToolsAdmin(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  source?: string;
}) {
  const { page, pageSize, offset } = parsePage(params.page, params.pageSize);
  const search = params.search?.trim();
  const status = params.status?.trim();
  const source = params.source?.trim();

  const filters = [];
  if (status && status !== 'all') {
    filters.push(eq(directoryTool.status, status));
  }
  if (source && source !== 'all') {
    filters.push(eq(directoryTool.source, source));
  }
  if (search) {
    filters.push(
      or(
        like(directoryTool.slug, `%${search}%`),
        like(directoryToolTranslation.name, `%${search}%`),
        like(directoryTool.websiteUrl, `%${search}%`)
      )!
    );
  }
  const where = filters.length ? and(...filters) : undefined;

  const base = db()
    .select({
      id: directoryTool.id,
      slug: directoryTool.slug,
      iconUrl: directoryTool.iconUrl,
      websiteUrl: directoryTool.websiteUrl,
      pricing: directoryTool.pricing,
      authorName: directoryTool.authorName,
      categoryId: directoryTool.categoryId,
      source: directoryTool.source,
      plan: directoryTool.plan,
      featured: directoryTool.featured,
      sponsored: directoryTool.sponsored,
      sort: directoryTool.sort,
      status: directoryTool.status,
      publishedAt: directoryTool.publishedAt,
      createdAt: directoryTool.createdAt,
      name: directoryToolTranslation.name,
      tagline: directoryToolTranslation.tagline,
      categoryName: directoryCategoryTranslation.name,
    })
    .from(directoryTool)
    .leftJoin(
      directoryToolTranslation,
      and(
        eq(directoryToolTranslation.toolId, directoryTool.id),
        eq(directoryToolTranslation.locale, 'en')
      )
    )
    .leftJoin(
      directoryCategory,
      eq(directoryCategory.id, directoryTool.categoryId)
    )
    .leftJoin(
      directoryCategoryTranslation,
      and(
        eq(directoryCategoryTranslation.categoryId, directoryCategory.id),
        eq(directoryCategoryTranslation.locale, 'en')
      )
    );

  const rows = where
    ? await base
        .where(where)
        .orderBy(desc(directoryTool.createdAt))
        .limit(pageSize)
        .offset(offset)
    : await base
        .orderBy(desc(directoryTool.createdAt))
        .limit(pageSize)
        .offset(offset);

  const totalBase = db()
    .select({ total: count() })
    .from(directoryTool)
    .leftJoin(
      directoryToolTranslation,
      and(
        eq(directoryToolTranslation.toolId, directoryTool.id),
        eq(directoryToolTranslation.locale, 'en')
      )
    );
  const totalRow = where ? await totalBase.where(where) : await totalBase;

  return {
    items: rows.map((r: any) => ({
      id: r.id,
      slug: r.slug,
      name: r.name || r.slug,
      tagline: r.tagline || '',
      iconUrl: r.iconUrl || '',
      websiteUrl: r.websiteUrl || '',
      pricing: r.pricing,
      authorName: r.authorName || '',
      categoryId: r.categoryId,
      categoryName: r.categoryName || '',
      source: r.source,
      plan: r.plan,
      featured: Boolean(r.featured),
      sponsored: Boolean(r.sponsored),
      sort: r.sort,
      status: r.status,
      publishedAt: r.publishedAt?.toISOString?.() ?? null,
      createdAt: r.createdAt?.toISOString?.() ?? String(r.createdAt),
    })),
    total: Number(totalRow[0]?.total || 0),
    page,
    pageSize,
  };
}

export async function getDirectoryToolAdmin(id: string) {
  const rows = await db()
    .select({
      id: directoryTool.id,
      slug: directoryTool.slug,
      iconUrl: directoryTool.iconUrl,
      websiteUrl: directoryTool.websiteUrl,
      pricing: directoryTool.pricing,
      authorName: directoryTool.authorName,
      categoryId: directoryTool.categoryId,
      screenshots: directoryTool.screenshots,
      source: directoryTool.source,
      plan: directoryTool.plan,
      featured: directoryTool.featured,
      sponsored: directoryTool.sponsored,
      sort: directoryTool.sort,
      status: directoryTool.status,
      name: directoryToolTranslation.name,
      tagline: directoryToolTranslation.tagline,
      introduction: directoryToolTranslation.introduction,
    })
    .from(directoryTool)
    .leftJoin(
      directoryToolTranslation,
      and(
        eq(directoryToolTranslation.toolId, directoryTool.id),
        eq(directoryToolTranslation.locale, 'en')
      )
    )
    .where(eq(directoryTool.id, id))
    .limit(1);
  const tool = rows[0];
  if (!tool) throw new Error('Tool not found');

  const zh = await db()
    .select({
      name: directoryToolTranslation.name,
      tagline: directoryToolTranslation.tagline,
      introduction: directoryToolTranslation.introduction,
    })
    .from(directoryToolTranslation)
    .where(
      and(
        eq(directoryToolTranslation.toolId, id),
        eq(directoryToolTranslation.locale, 'zh')
      )
    )
    .limit(1);

  const tags = await db()
    .select({ tagId: directoryToolTag.tagId })
    .from(directoryToolTag)
    .where(eq(directoryToolTag.toolId, id));

  return {
    id: tool.id,
    slug: tool.slug,
    iconUrl: tool.iconUrl || '',
    websiteUrl: tool.websiteUrl || '',
    pricing: tool.pricing,
    authorName: tool.authorName || '',
    categoryId: tool.categoryId || '',
    screenshots: tool.screenshots || '',
    source: tool.source,
    plan: tool.plan,
    featured: Boolean(tool.featured),
    sponsored: Boolean(tool.sponsored),
    sort: tool.sort,
    status: tool.status,
    name: tool.name || '',
    tagline: tool.tagline || '',
    introduction: tool.introduction || '',
    nameZh: zh[0]?.name || '',
    taglineZh: zh[0]?.tagline || '',
    introductionZh: zh[0]?.introduction || '',
    tagIds: tags.map((t: any) => t.tagId),
  };
}

async function upsertToolTranslation(
  toolId: string,
  locale: string,
  data: {
    name: string;
    tagline?: string | null;
    introduction?: string | null;
  }
) {
  const existing = await db()
    .select({ id: directoryToolTranslation.id })
    .from(directoryToolTranslation)
    .where(
      and(
        eq(directoryToolTranslation.toolId, toolId),
        eq(directoryToolTranslation.locale, locale)
      )
    )
    .limit(1);
  const payload = {
    name: data.name,
    tagline: data.tagline?.trim() ? data.tagline.trim() : null,
    introduction: data.introduction?.trim() ? data.introduction.trim() : null,
  };
  if (existing[0]) {
    await db()
      .update(directoryToolTranslation)
      .set(payload)
      .where(eq(directoryToolTranslation.id, existing[0].id));
  } else {
    await db()
      .insert(directoryToolTranslation)
      .values({
        id: getUuid(),
        toolId,
        locale,
        ...payload,
      });
  }
}

async function replaceToolTags(toolId: string, tagIds: string[]) {
  await db()
    .delete(directoryToolTag)
    .where(eq(directoryToolTag.toolId, toolId));
  const unique = [...new Set(tagIds.filter(Boolean))];
  if (unique.length) {
    await db()
      .insert(directoryToolTag)
      .values(unique.map((tagId) => ({ toolId, tagId })));
  }
}

export async function createDirectoryToolAdmin(input: {
  slug?: string;
  name: string;
  tagline?: string;
  introduction?: string;
  nameZh?: string;
  taglineZh?: string;
  introductionZh?: string;
  websiteUrl?: string;
  iconUrl?: string;
  pricing?: string;
  authorName?: string;
  categoryId?: string;
  source?: string;
  status?: string;
  featured?: boolean;
  sponsored?: boolean;
  sort?: number;
  tagIds?: string[];
}) {
  const name = input.name.trim();
  if (!name) throw new Error('Name is required');
  const slug = await ensureUniqueSlug(
    directoryTool,
    input.slug?.trim() || name
  );
  const id = getUuid();
  const status = input.status || 'published';
  const now = new Date();
  await db()
    .insert(directoryTool)
    .values({
      id,
      slug,
      iconUrl: input.iconUrl?.trim() || null,
      websiteUrl: input.websiteUrl?.trim() || null,
      pricing: input.pricing || 'free',
      authorName: input.authorName?.trim() || null,
      categoryId: input.categoryId?.trim() || null,
      source: input.source === 'community' ? 'community' : 'editorial',
      featured: Boolean(input.featured),
      sponsored: Boolean(input.sponsored),
      sort: input.sort ?? 0,
      status,
      publishedAt: status === 'published' ? now : null,
    });
  await upsertToolTranslation(id, 'en', {
    name,
    tagline: input.tagline,
    introduction: input.introduction,
  });
  if (input.nameZh?.trim()) {
    await upsertToolTranslation(id, 'zh', {
      name: input.nameZh.trim(),
      tagline: input.taglineZh,
      introduction: input.introductionZh,
    });
  }
  if (input.tagIds?.length) {
    await replaceToolTags(id, input.tagIds);
  }
  return { id, slug };
}

export async function updateDirectoryToolAdmin(
  id: string,
  input: {
    slug?: string;
    name?: string;
    tagline?: string;
    introduction?: string;
    nameZh?: string;
    taglineZh?: string;
    introductionZh?: string;
    websiteUrl?: string;
    iconUrl?: string;
    pricing?: string;
    authorName?: string;
    categoryId?: string | null;
    source?: string;
    status?: string;
    featured?: boolean;
    sponsored?: boolean;
    sort?: number;
    tagIds?: string[];
  }
) {
  const existing = await db()
    .select({ id: directoryTool.id, status: directoryTool.status })
    .from(directoryTool)
    .where(eq(directoryTool.id, id))
    .limit(1);
  if (!existing[0]) throw new Error('Tool not found');

  const patch: Record<string, unknown> = {};
  // Slug and source stay locked after create (UI + API).
  if (input.iconUrl !== undefined)
    patch.iconUrl = input.iconUrl?.trim() || null;
  if (input.websiteUrl !== undefined)
    patch.websiteUrl = input.websiteUrl?.trim() || null;
  if (input.pricing !== undefined) patch.pricing = input.pricing;
  if (input.authorName !== undefined)
    patch.authorName = input.authorName?.trim() || null;
  if (input.categoryId !== undefined)
    patch.categoryId = input.categoryId?.trim() || null;
  if (input.featured !== undefined) patch.featured = Boolean(input.featured);
  if (input.sponsored !== undefined) patch.sponsored = Boolean(input.sponsored);
  if (input.sort !== undefined) patch.sort = input.sort;
  if (input.status !== undefined) {
    const cur = existing[0].status;
    const next = input.status;
    // Status is not a free-form field: only review / take-down transitions.
    const allowed =
      (cur === 'pending' && (next === 'published' || next === 'rejected')) ||
      (cur === 'published' && next === 'rejected');
    if (!allowed) {
      throw new Error('Invalid tool status transition');
    }
    patch.status = next;
    if (next === 'published' && cur !== 'published') {
      patch.publishedAt = new Date();
    }
  }
  if (Object.keys(patch).length) {
    await db().update(directoryTool).set(patch).where(eq(directoryTool.id, id));
  }
  if (input.name?.trim()) {
    await upsertToolTranslation(id, 'en', {
      name: input.name.trim(),
      tagline: input.tagline,
      introduction: input.introduction,
    });
  }
  if (input.nameZh !== undefined) {
    if (input.nameZh.trim()) {
      await upsertToolTranslation(id, 'zh', {
        name: input.nameZh.trim(),
        tagline: input.taglineZh,
        introduction: input.introductionZh,
      });
    } else {
      await db()
        .delete(directoryToolTranslation)
        .where(
          and(
            eq(directoryToolTranslation.toolId, id),
            eq(directoryToolTranslation.locale, 'zh')
          )
        );
    }
  }
  // [] must clear tags — truthy check would leave stale links.
  if (input.tagIds !== undefined) {
    await replaceToolTags(id, input.tagIds);
  }
  return { id };
}

/** Take a published tool offline (→ rejected). Does not delete the row. */
export async function forceUnpublishDirectoryToolAdmin(id: string) {
  const existing = await db()
    .select({
      id: directoryTool.id,
      status: directoryTool.status,
    })
    .from(directoryTool)
    .where(eq(directoryTool.id, id))
    .limit(1);
  if (!existing[0]) throw new Error('Tool not found');
  if (existing[0].status !== 'published') {
    throw new Error('Only published tools can be force-unpublished');
  }
  await db()
    .update(directoryTool)
    .set({ status: 'rejected' })
    .where(eq(directoryTool.id, id));
  return { id };
}

export async function deleteDirectoryToolAdmin(id: string) {
  const existing = await db()
    .select({
      id: directoryTool.id,
      status: directoryTool.status,
      submittedBy: directoryTool.submittedBy,
    })
    .from(directoryTool)
    .where(eq(directoryTool.id, id))
    .limit(1);
  if (!existing[0]) throw new Error('Tool not found');
  if (existing[0].status === 'published') {
    throw new Error(
      'Published tools cannot be deleted — force-unpublish instead'
    );
  }
  // pending_payment may still have an open Checkout; abandon it first so a
  // late payment cannot settle into a missing row.
  if (existing[0].status === 'pending_payment' && existing[0].submittedBy) {
    const { directoryToolOrderReference } = await import('./payment');
    const reference = directoryToolOrderReference(id);
    const userId = existing[0].submittedBy;
    type RelatedOrder = {
      id: string;
      status: string;
      paymentProvider: string | null;
      paymentSessionId: string | null;
    };
    const relatedOrders: RelatedOrder[] = await db()
      .select({
        id: order.id,
        status: order.status,
        paymentProvider: order.paymentProvider,
        paymentSessionId: order.paymentSessionId,
      })
      .from(order)
      .where(and(eq(order.reference, reference), eq(order.userId, userId)));
    if (relatedOrders.some((o) => o.status === 'paid')) {
      throw new Error('already_paid');
    }
    let openOrders = relatedOrders.filter(
      (o) => o.status === 'created' || o.status === 'pending'
    );
    const { expireOpenCheckoutSessions } =
      await import('@/modules/payment/service');
    const { alreadyComplete } = await expireOpenCheckoutSessions(openOrders);
    if (alreadyComplete) {
      throw new Error('already_paid');
    }
    const refreshed: RelatedOrder[] = await db()
      .select({
        id: order.id,
        status: order.status,
        paymentProvider: order.paymentProvider,
        paymentSessionId: order.paymentSessionId,
      })
      .from(order)
      .where(and(eq(order.reference, reference), eq(order.userId, userId)));
    if (refreshed.some((o) => o.status === 'paid')) {
      throw new Error('already_paid');
    }
    if (
      refreshed.some((o) => o.status === 'created' || o.status === 'pending')
    ) {
      const now = new Date();
      await db()
        .update(order)
        .set({
          status: 'canceled',
          checkoutUrl: null,
          updatedAt: now,
        })
        .where(
          and(
            eq(order.reference, reference),
            eq(order.userId, userId),
            inArray(order.status, ['created', 'pending'])
          )
        );
    }
  }
  // Explicit cleanup: D1/SQLite may not enforce FK cascades.
  await db().delete(directoryToolTag).where(eq(directoryToolTag.toolId, id));
  await db()
    .delete(directoryCollectionTool)
    .where(eq(directoryCollectionTool.toolId, id));
  await db()
    .delete(directoryToolTranslation)
    .where(eq(directoryToolTranslation.toolId, id));
  await db().delete(directoryTool).where(eq(directoryTool.id, id));
}

// ─── Sponsor ads ────────────────────────────────────────────────────────────

export async function listDirectoryAdsAdmin(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
}) {
  const { page, pageSize, offset } = parsePage(params.page, params.pageSize);
  const search = params.search?.trim();
  const status = params.status?.trim();

  const filters = [];
  if (status && status !== 'all') {
    filters.push(eq(directorySponsorAd.status, status));
  }
  if (search) {
    filters.push(
      or(
        like(directorySponsorAd.name, `%${search}%`),
        like(directorySponsorAd.url, `%${search}%`)
      )!
    );
  }
  const where = filters.length ? and(...filters) : undefined;

  const base = db().select().from(directorySponsorAd);
  const rows = where
    ? await base
        .where(where)
        .orderBy(desc(directorySponsorAd.createdAt))
        .limit(pageSize)
        .offset(offset)
    : await base
        .orderBy(desc(directorySponsorAd.createdAt))
        .limit(pageSize)
        .offset(offset);

  const totalRow = where
    ? await db()
        .select({ total: count() })
        .from(directorySponsorAd)
        .where(where)
    : await db().select({ total: count() }).from(directorySponsorAd);

  return {
    items: rows.map((r: any) => ({
      id: r.id,
      userId: r.userId,
      name: r.name,
      tagline: r.tagline || '',
      url: r.url,
      iconUrl: r.iconUrl || '',
      tier: r.tier,
      status: r.status,
      startsAt: r.startsAt?.toISOString?.() ?? null,
      endsAt: r.endsAt?.toISOString?.() ?? null,
      createdAt: r.createdAt?.toISOString?.() ?? String(r.createdAt),
    })),
    total: Number(totalRow[0]?.total || 0),
    page,
    pageSize,
  };
}

/** Creative fields only — tier/status/dates are billing inventory and stay locked. */
export async function updateDirectoryAdAdmin(
  id: string,
  input: {
    name?: string;
    tagline?: string;
    url?: string;
    iconUrl?: string;
  }
) {
  const existing = await db()
    .select({ id: directorySponsorAd.id })
    .from(directorySponsorAd)
    .where(eq(directorySponsorAd.id, id))
    .limit(1);
  if (!existing[0]) throw new Error('Ad not found');

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.tagline !== undefined) patch.tagline = input.tagline.trim() || null;
  if (input.url !== undefined) patch.url = input.url.trim();
  if (input.iconUrl !== undefined) patch.iconUrl = input.iconUrl.trim() || null;
  if (!Object.keys(patch).length) return { id };

  await db()
    .update(directorySponsorAd)
    .set(patch)
    .where(eq(directorySponsorAd.id, id));
  return { id };
}

/**
 * Take an active ad offline and free its inventory seat.
 * Cancels related subscriptions best-effort so the next invoice cannot
 * revive the listing. Does not refund the current period.
 */
export async function forceExpireDirectoryAdAdmin(id: string) {
  const existing = await db()
    .select({
      id: directorySponsorAd.id,
      status: directorySponsorAd.status,
      userId: directorySponsorAd.userId,
    })
    .from(directorySponsorAd)
    .where(eq(directorySponsorAd.id, id))
    .limit(1);
  if (!existing[0]) throw new Error('Ad not found');
  if (existing[0].status !== 'active') {
    throw new Error('Only active ads can be force-expired');
  }

  const now = new Date();
  await db()
    .update(directorySponsorAd)
    .set({ status: 'expired', endsAt: now, updatedAt: now })
    .where(
      and(
        eq(directorySponsorAd.id, id),
        eq(directorySponsorAd.status, 'active')
      )
    );

  const [after] = await db()
    .select({ status: directorySponsorAd.status })
    .from(directorySponsorAd)
    .where(eq(directorySponsorAd.id, id))
    .limit(1);
  if (!after || after.status !== 'expired') {
    throw new Error('Only active ads can be force-expired');
  }

  // Stop renewals from reactivating the seat after take-down.
  const { directoryAdOrderReference } = await import('./payment');
  const reference = directoryAdOrderReference(id);
  const relatedOrders = await db()
    .select({ subscriptionNo: order.subscriptionNo })
    .from(order)
    .where(
      and(eq(order.reference, reference), eq(order.userId, existing[0].userId))
    );
  const subscriptionNos: string[] = [];
  for (const o of relatedOrders) {
    if (o.subscriptionNo && !subscriptionNos.includes(o.subscriptionNo)) {
      subscriptionNos.push(o.subscriptionNo);
    }
  }
  const canceledSubscriptions: string[] = [];
  if (subscriptionNos.length > 0) {
    const { cancelUserSubscription } =
      await import('@/modules/payment/service');
    const { findBySubscriptionNo, SubscriptionStatus } =
      await import('@/modules/subscriptions/service');
    for (const subscriptionNo of subscriptionNos) {
      const sub = await findBySubscriptionNo(subscriptionNo);
      if (!sub || sub.userId !== existing[0].userId) continue;
      if (
        sub.status === SubscriptionStatus.CANCELED ||
        sub.status === SubscriptionStatus.EXPIRED
      ) {
        continue;
      }
      try {
        await cancelUserSubscription({
          userId: existing[0].userId,
          subscriptionNo,
          immediate: true,
        });
        canceledSubscriptions.push(subscriptionNo);
      } catch (err) {
        console.error('[forceExpireDirectoryAdAdmin] sub cancel failed', {
          subscriptionNo,
          err,
        });
      }
    }
  }

  return { id, canceledSubscriptions };
}

export async function deleteDirectoryAdAdmin(id: string) {
  const existing = await db()
    .select({
      id: directorySponsorAd.id,
      status: directorySponsorAd.status,
      userId: directorySponsorAd.userId,
    })
    .from(directorySponsorAd)
    .where(eq(directorySponsorAd.id, id))
    .limit(1);
  if (!existing[0]) throw new Error('Ad not found');
  if (existing[0].status === 'active') {
    throw new Error('Active ads cannot be deleted — force-expire instead');
  }
  // pending_payment still holds inventory and may have an open Checkout —
  // abandon like user「取消付款」before hard-delete, or money can clear
  // with nothing to fulfill.
  if (existing[0].status === 'pending_payment') {
    const { cancelPendingSponsorAdPayment } = await import('./user-actions');
    await cancelPendingSponsorAdPayment({
      userId: existing[0].userId,
      adId: id,
    });
  }
  await db().delete(directorySponsorAd).where(eq(directorySponsorAd.id, id));
}

// ─── Collections ────────────────────────────────────────────────────────────

export async function listDirectoryCollectionsAdmin(params: {
  page?: number;
  pageSize?: number;
  search?: string;
}) {
  const { page, pageSize, offset } = parsePage(params.page, params.pageSize);
  const search = params.search?.trim();

  const conditions = search
    ? or(
        like(directoryCollection.slug, `%${search}%`),
        like(directoryCollectionTranslation.name, `%${search}%`)
      )
    : undefined;

  const base = db()
    .select({
      id: directoryCollection.id,
      slug: directoryCollection.slug,
      icon: directoryCollection.icon,
      coverUrl: directoryCollection.coverUrl,
      sort: directoryCollection.sort,
      status: directoryCollection.status,
      createdAt: directoryCollection.createdAt,
      name: directoryCollectionTranslation.name,
      description: directoryCollectionTranslation.description,
    })
    .from(directoryCollection)
    .leftJoin(
      directoryCollectionTranslation,
      and(
        eq(directoryCollectionTranslation.collectionId, directoryCollection.id),
        eq(directoryCollectionTranslation.locale, 'en')
      )
    );

  const rows = conditions
    ? await base
        .where(conditions)
        .orderBy(desc(directoryCollection.sort), asc(directoryCollection.slug))
        .limit(pageSize)
        .offset(offset)
    : await base
        .orderBy(desc(directoryCollection.sort), asc(directoryCollection.slug))
        .limit(pageSize)
        .offset(offset);

  const totalRow = conditions
    ? await db()
        .select({ total: count() })
        .from(directoryCollection)
        .leftJoin(
          directoryCollectionTranslation,
          and(
            eq(
              directoryCollectionTranslation.collectionId,
              directoryCollection.id
            ),
            eq(directoryCollectionTranslation.locale, 'en')
          )
        )
        .where(conditions)
    : await db().select({ total: count() }).from(directoryCollection);

  const ids = rows.map((r: any) => r.id as string);
  const zhMap = new Map<string, { name: string; description: string | null }>();
  const toolCountMap = new Map<string, number>();
  const toolIdsMap = new Map<string, string[]>();

  if (ids.length > 0) {
    const zhAll = await db()
      .select({
        collectionId: directoryCollectionTranslation.collectionId,
        name: directoryCollectionTranslation.name,
        description: directoryCollectionTranslation.description,
      })
      .from(directoryCollectionTranslation)
      .where(eq(directoryCollectionTranslation.locale, 'zh'));
    for (const z of zhAll) {
      if (ids.includes(z.collectionId)) {
        zhMap.set(z.collectionId, {
          name: z.name,
          description: z.description,
        });
      }
    }

    const toolRows = await db()
      .select({
        collectionId: directoryCollectionTool.collectionId,
        toolId: directoryCollectionTool.toolId,
        sort: directoryCollectionTool.sort,
      })
      .from(directoryCollectionTool)
      .orderBy(asc(directoryCollectionTool.sort));

    for (const row of toolRows) {
      if (!ids.includes(row.collectionId)) continue;
      const list = toolIdsMap.get(row.collectionId) || [];
      list.push(row.toolId);
      toolIdsMap.set(row.collectionId, list);
      toolCountMap.set(row.collectionId, list.length);
    }
  }

  return {
    items: rows.map((r: any) => ({
      id: r.id,
      slug: r.slug,
      icon: r.icon,
      coverUrl: r.coverUrl,
      sort: r.sort,
      status: r.status,
      name: r.name || r.slug,
      description: r.description,
      nameZh: zhMap.get(r.id)?.name || '',
      descriptionZh: zhMap.get(r.id)?.description || '',
      toolCount: toolCountMap.get(r.id) || 0,
      toolIds: toolIdsMap.get(r.id) || [],
      createdAt:
        r.createdAt instanceof Date
          ? r.createdAt.toISOString()
          : String(r.createdAt),
    })),
    total: Number(totalRow[0]?.total || 0),
    page,
    pageSize,
  };
}

export async function listDirectoryToolOptions() {
  const rows = await db()
    .select({
      id: directoryTool.id,
      slug: directoryTool.slug,
      name: directoryToolTranslation.name,
      status: directoryTool.status,
    })
    .from(directoryTool)
    .leftJoin(
      directoryToolTranslation,
      and(
        eq(directoryToolTranslation.toolId, directoryTool.id),
        eq(directoryToolTranslation.locale, 'en')
      )
    )
    .where(eq(directoryTool.status, 'published'))
    .orderBy(asc(directoryToolTranslation.name), asc(directoryTool.slug));
  return rows.map((r: any) => ({
    id: r.id,
    slug: r.slug,
    name: r.name || r.slug,
  }));
}

async function upsertCollectionTranslation(
  collectionId: string,
  locale: string,
  name: string,
  description?: string | null
) {
  const existing = await db()
    .select({ id: directoryCollectionTranslation.id })
    .from(directoryCollectionTranslation)
    .where(
      and(
        eq(directoryCollectionTranslation.collectionId, collectionId),
        eq(directoryCollectionTranslation.locale, locale)
      )
    )
    .limit(1);

  if (existing[0]) {
    await db()
      .update(directoryCollectionTranslation)
      .set({
        name,
        description: description?.trim() ? description.trim() : null,
      })
      .where(eq(directoryCollectionTranslation.id, existing[0].id));
  } else {
    await db()
      .insert(directoryCollectionTranslation)
      .values({
        id: getUuid(),
        collectionId,
        locale,
        name,
        description: description?.trim() ? description.trim() : null,
      });
  }
}

async function replaceCollectionTools(collectionId: string, toolIds: string[]) {
  await db()
    .delete(directoryCollectionTool)
    .where(eq(directoryCollectionTool.collectionId, collectionId));
  const unique = [...new Set(toolIds.filter(Boolean))];
  if (unique.length) {
    await db()
      .insert(directoryCollectionTool)
      .values(
        unique.map((toolId, index) => ({
          collectionId,
          toolId,
          // Lower sort ranks first (matches public asc orderBy).
          sort: index,
        }))
      );
  }
}

export async function createDirectoryCollectionAdmin(input: {
  slug?: string;
  name: string;
  description?: string;
  nameZh?: string;
  descriptionZh?: string;
  icon?: string;
  coverUrl?: string;
  sort?: number;
  status?: string;
  toolIds?: string[];
}) {
  const slug = await ensureUniqueSlug(
    directoryCollection,
    input.slug || input.name
  );
  const id = getUuid();
  await db()
    .insert(directoryCollection)
    .values({
      id,
      slug,
      icon: input.icon?.trim() || null,
      coverUrl: input.coverUrl?.trim() || null,
      sort: input.sort ?? 0,
      status: input.status === 'draft' ? 'draft' : 'published',
    });
  await upsertCollectionTranslation(
    id,
    'en',
    input.name.trim(),
    input.description
  );
  if (input.nameZh?.trim()) {
    await upsertCollectionTranslation(
      id,
      'zh',
      input.nameZh.trim(),
      input.descriptionZh
    );
  }
  if (input.toolIds) {
    await replaceCollectionTools(id, input.toolIds);
  }
  return { id, slug };
}

export async function updateDirectoryCollectionAdmin(
  id: string,
  input: {
    slug?: string;
    name?: string;
    description?: string;
    nameZh?: string;
    descriptionZh?: string;
    icon?: string;
    coverUrl?: string;
    sort?: number;
    status?: string;
    toolIds?: string[];
  }
) {
  const existing = await db()
    .select({ id: directoryCollection.id })
    .from(directoryCollection)
    .where(eq(directoryCollection.id, id))
    .limit(1);
  if (!existing[0]) throw new Error('Collection not found');

  // Slug is immutable after create — public collection URLs depend on it.
  const patch: Record<string, unknown> = {};
  if (input.icon !== undefined) patch.icon = input.icon?.trim() || null;
  if (input.coverUrl !== undefined)
    patch.coverUrl = input.coverUrl?.trim() || null;
  if (input.sort !== undefined) patch.sort = input.sort;
  if (input.status !== undefined) {
    patch.status = input.status === 'draft' ? 'draft' : 'published';
  }
  if (Object.keys(patch).length) {
    await db()
      .update(directoryCollection)
      .set(patch)
      .where(eq(directoryCollection.id, id));
  }
  if (input.name?.trim()) {
    await upsertCollectionTranslation(
      id,
      'en',
      input.name.trim(),
      input.description
    );
  }
  if (input.nameZh !== undefined) {
    if (input.nameZh.trim()) {
      await upsertCollectionTranslation(
        id,
        'zh',
        input.nameZh.trim(),
        input.descriptionZh
      );
    } else {
      await db()
        .delete(directoryCollectionTranslation)
        .where(
          and(
            eq(directoryCollectionTranslation.collectionId, id),
            eq(directoryCollectionTranslation.locale, 'zh')
          )
        );
    }
  }
  if (input.toolIds !== undefined) {
    await replaceCollectionTools(id, input.toolIds);
  }
  return { id };
}

export async function deleteDirectoryCollectionAdmin(id: string) {
  const existing = await db()
    .select({ id: directoryCollection.id })
    .from(directoryCollection)
    .where(eq(directoryCollection.id, id))
    .limit(1);
  if (!existing[0]) throw new Error('Collection not found');

  // Explicit cleanup: D1/SQLite may not enforce FK cascades.
  await db()
    .delete(directoryCollectionTool)
    .where(eq(directoryCollectionTool.collectionId, id));
  await db()
    .delete(directoryCollectionTranslation)
    .where(eq(directoryCollectionTranslation.collectionId, id));
  await db().delete(directoryCollection).where(eq(directoryCollection.id, id));
}
