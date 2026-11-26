import { and, asc, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';

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
} from '@/config/db/schema';
import {
  tiersForPlacement,
  type SponsorPlacement,
} from '@/lib/directory/sponsor-placement';

export interface LocalizedCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  sort: number;
  projectCount: number;
}

export interface LocalizedTag {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  projectCount: number;
}

export interface LocalizedCollection {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  coverUrl: string | null;
  sort: number;
  projectCount: number;
  previewTools: Array<{
    id: string;
    slug: string;
    name: string;
    iconUrl: string | null;
  }>;
}

export interface LocalizedTool {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  iconUrl: string | null;
  websiteUrl: string | null;
  pricing: string;
  authorName: string | null;
  categoryId: string | null;
  categorySlug: string | null;
  categoryName: string | null;
  screenshots: string[];
  source: string;
  plan: string | null;
  featured: boolean;
  sponsored: boolean;
  sort: number;
  publishedAt: Date | null;
  createdAt: Date;
  // Detail fields
  introduction?: string | null;
  howToUse?: string | null;
  features?: Array<{ title: string; description: string }>;
  useCases?: Array<{ title: string; description: string }>;
  faqs?: Array<{ question: string; answer: string }>;
  pros?: string[];
  cons?: string[];
  tags?: LocalizedTag[];
  related?: LocalizedTool[];
  popular?: LocalizedTool[];
  collections?: Array<{ id: string; slug: string; name: string }>;
}

function normalizeLocale(locale?: string) {
  return locale?.startsWith('zh') ? 'zh' : 'en';
}

function parseJsonValue<T>(raw: unknown, fallback: T): T {
  if (raw == null || raw === '') return fallback;
  if (typeof raw !== 'string') return raw as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function parseScreenshots(raw: unknown): string[] {
  const parsed = parseJsonValue<unknown>(raw, []);
  return Array.isArray(parsed)
    ? parsed.filter((item): item is string => typeof item === 'string')
    : [];
}

function isFeaturedActive(
  featured: unknown,
  featuredUntil: Date | string | null | undefined
) {
  if (!featured) return false;
  if (!featuredUntil) return true;
  const until =
    featuredUntil instanceof Date ? featuredUntil : new Date(featuredUntil);
  return !Number.isNaN(until.getTime()) && until.getTime() > Date.now();
}

function mapToolRow(t: any): LocalizedTool {
  return {
    id: t.id,
    slug: t.slug,
    name: t.name || t.slug,
    tagline: t.tagline,
    iconUrl: t.iconUrl,
    websiteUrl: t.websiteUrl,
    pricing: t.pricing || 'free',
    authorName: t.authorName,
    categoryId: t.categoryId,
    categorySlug: t.categorySlug,
    categoryName: t.categoryName,
    screenshots: parseScreenshots(t.screenshots),
    source: t.source || 'editorial',
    plan: t.plan || null,
    featured: isFeaturedActive(t.featured, t.featuredUntil),
    sponsored: Boolean(t.sponsored),
    sort: t.sort,
    publishedAt: t.publishedAt ? new Date(t.publishedAt) : null,
    createdAt: new Date(t.createdAt),
  };
}

/** Prefer still-active featured listings when sorting "recommended". */
function featuredRankSql() {
  // D1 rejects bound Date params; use epoch ms (same as timestamp_ms columns).
  const nowMs = Date.now();
  return sql`(case when ${directoryTool.featured} and (${directoryTool.featuredUntil} is null or ${directoryTool.featuredUntil} > ${nowMs}) then 1 else 0 end)`;
}

const toolSelectFields = {
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
  featuredUntil: directoryTool.featuredUntil,
  sponsored: directoryTool.sponsored,
  sort: directoryTool.sort,
  status: directoryTool.status,
  publishedAt: directoryTool.publishedAt,
  createdAt: directoryTool.createdAt,
  name: directoryToolTranslation.name,
  tagline: directoryToolTranslation.tagline,
  categorySlug: directoryCategory.slug,
  categoryName: directoryCategoryTranslation.name,
};

/**
 * Fetch all categories localized by locale with project counts
 */
export async function getDirectoryCategories(
  locale = 'en'
): Promise<LocalizedCategory[]> {
  const normLocale = normalizeLocale(locale);

  const rows = await db()
    .select({
      id: directoryCategory.id,
      slug: directoryCategory.slug,
      icon: directoryCategory.icon,
      sort: directoryCategory.sort,
      name: directoryCategoryTranslation.name,
      description: directoryCategoryTranslation.description,
    })
    .from(directoryCategory)
    .leftJoin(
      directoryCategoryTranslation,
      and(
        eq(directoryCategoryTranslation.categoryId, directoryCategory.id),
        eq(directoryCategoryTranslation.locale, normLocale)
      )
    )
    .where(eq(directoryCategory.status, 'published'))
    .orderBy(desc(directoryCategory.sort));

  const toolCountRows = await db()
    .select({
      categoryId: directoryTool.categoryId,
      count: sql<number>`count(*)`.as('count'),
    })
    .from(directoryTool)
    .where(eq(directoryTool.status, 'published'))
    .groupBy(directoryTool.categoryId);

  const countMap = new Map<string, number>();
  toolCountRows.forEach((r: any) => {
    if (r.categoryId) countMap.set(r.categoryId, Number(r.count));
  });

  return rows.map((cat: any) => ({
    id: cat.id,
    slug: cat.slug,
    name: cat.name || cat.slug,
    description: cat.description,
    icon: cat.icon,
    sort: cat.sort,
    projectCount: countMap.get(cat.id) || 0,
  }));
}

/**
 * Fetch all tags localized by locale with project counts
 */
export async function getDirectoryTags(locale = 'en'): Promise<LocalizedTag[]> {
  const normLocale = normalizeLocale(locale);

  const rows = await db()
    .select({
      id: directoryTag.id,
      slug: directoryTag.slug,
      name: directoryTagTranslation.name,
      description: directoryTagTranslation.description,
    })
    .from(directoryTag)
    .leftJoin(
      directoryTagTranslation,
      and(
        eq(directoryTagTranslation.tagId, directoryTag.id),
        eq(directoryTagTranslation.locale, normLocale)
      )
    );

  const toolCountRows = await db()
    .select({
      tagId: directoryToolTag.tagId,
      count: sql<number>`count(*)`.as('count'),
    })
    .from(directoryToolTag)
    .innerJoin(
      directoryTool,
      and(
        eq(directoryTool.id, directoryToolTag.toolId),
        eq(directoryTool.status, 'published')
      )
    )
    .groupBy(directoryToolTag.tagId);

  const countMap = new Map<string, number>();
  toolCountRows.forEach((r: any) => {
    countMap.set(r.tagId, Number(r.count));
  });

  return rows.map((tag: any) => ({
    id: tag.id,
    slug: tag.slug,
    name: tag.name || tag.slug,
    description: tag.description,
    projectCount: countMap.get(tag.id) || 0,
  }));
}

/**
 * Fetch all collections localized by locale with project counts and preview tools
 */
export async function getDirectoryCollections(
  locale = 'en'
): Promise<LocalizedCollection[]> {
  const normLocale = normalizeLocale(locale);

  const rows = await db()
    .select({
      id: directoryCollection.id,
      slug: directoryCollection.slug,
      icon: directoryCollection.icon,
      coverUrl: directoryCollection.coverUrl,
      sort: directoryCollection.sort,
      name: directoryCollectionTranslation.name,
      description: directoryCollectionTranslation.description,
    })
    .from(directoryCollection)
    .leftJoin(
      directoryCollectionTranslation,
      and(
        eq(directoryCollectionTranslation.collectionId, directoryCollection.id),
        eq(directoryCollectionTranslation.locale, normLocale)
      )
    )
    .where(eq(directoryCollection.status, 'published'))
    .orderBy(desc(directoryCollection.sort), asc(directoryCollection.slug));

  const toolCountRows = await db()
    .select({
      collectionId: directoryCollectionTool.collectionId,
      count: sql<number>`count(*)`.as('count'),
    })
    .from(directoryCollectionTool)
    .innerJoin(
      directoryTool,
      and(
        eq(directoryTool.id, directoryCollectionTool.toolId),
        eq(directoryTool.status, 'published')
      )
    )
    .groupBy(directoryCollectionTool.collectionId);

  const countMap = new Map<string, number>();
  toolCountRows.forEach((r: any) => {
    countMap.set(r.collectionId, Number(r.count));
  });

  const previewRows = await db()
    .select({
      collectionId: directoryCollectionTool.collectionId,
      toolId: directoryTool.id,
      slug: directoryTool.slug,
      iconUrl: directoryTool.iconUrl,
      name: directoryToolTranslation.name,
      sort: directoryCollectionTool.sort,
    })
    .from(directoryCollectionTool)
    .innerJoin(
      directoryTool,
      and(
        eq(directoryTool.id, directoryCollectionTool.toolId),
        eq(directoryTool.status, 'published')
      )
    )
    .leftJoin(
      directoryToolTranslation,
      and(
        eq(directoryToolTranslation.toolId, directoryTool.id),
        eq(directoryToolTranslation.locale, normLocale)
      )
    )
    .orderBy(asc(directoryCollectionTool.sort));

  const previewMap = new Map<
    string,
    Array<{ id: string; slug: string; name: string; iconUrl: string | null }>
  >();
  previewRows.forEach((r: any) => {
    const list = previewMap.get(r.collectionId) || [];
    if (list.length < 4) {
      list.push({
        id: r.toolId,
        slug: r.slug,
        name: r.name || r.slug,
        iconUrl: r.iconUrl || null,
      });
      previewMap.set(r.collectionId, list);
    }
  });

  return rows.map((col: any) => ({
    id: col.id,
    slug: col.slug,
    name: col.name || col.slug,
    description: col.description,
    icon: col.icon,
    coverUrl: col.coverUrl || null,
    sort: col.sort,
    projectCount: countMap.get(col.id) || 0,
    previewTools: previewMap.get(col.id) || [],
  }));
}

/**
 * Fetch a single collection by slug
 */
export async function getDirectoryCollectionBySlug(
  slug: string,
  locale = 'en'
): Promise<LocalizedCollection | null> {
  const normLocale = normalizeLocale(locale);

  const [row] = await db()
    .select({
      id: directoryCollection.id,
      slug: directoryCollection.slug,
      icon: directoryCollection.icon,
      coverUrl: directoryCollection.coverUrl,
      sort: directoryCollection.sort,
      name: directoryCollectionTranslation.name,
      description: directoryCollectionTranslation.description,
    })
    .from(directoryCollection)
    .leftJoin(
      directoryCollectionTranslation,
      and(
        eq(directoryCollectionTranslation.collectionId, directoryCollection.id),
        eq(directoryCollectionTranslation.locale, normLocale)
      )
    )
    .where(
      and(
        eq(directoryCollection.slug, slug),
        eq(directoryCollection.status, 'published')
      )
    );

  if (!row) return null;

  const [countRow] = await db()
    .select({ count: sql<number>`count(*)`.as('count') })
    .from(directoryCollectionTool)
    .innerJoin(
      directoryTool,
      and(
        eq(directoryTool.id, directoryCollectionTool.toolId),
        eq(directoryTool.status, 'published')
      )
    )
    .where(eq(directoryCollectionTool.collectionId, row.id));

  return {
    id: row.id,
    slug: row.slug,
    name: row.name || row.slug,
    description: row.description,
    icon: row.icon,
    coverUrl: row.coverUrl || null,
    sort: row.sort,
    projectCount: Number(countRow?.count || 0),
    previewTools: [],
  };
}

/**
 * Fetch localized tool list with filtering and pagination
 */
export async function getDirectoryTools(options: {
  locale?: string;
  categorySlug?: string;
  tagSlug?: string;
  collectionSlug?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
  source?: 'all' | 'community' | 'editorial';
}): Promise<{
  items: LocalizedTool[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const locale = normalizeLocale(options.locale);
  const page = Math.max(1, options.page || 1);
  const pageSize = Math.min(Math.max(1, options.pageSize || 24), 500);
  const categorySlug =
    options.categorySlug && options.categorySlug !== 'all'
      ? options.categorySlug
      : undefined;
  const tagSlug = options.tagSlug || undefined;
  const collectionSlug = options.collectionSlug || undefined;
  const source =
    options.source && options.source !== 'all' ? options.source : undefined;

  const conditions = [eq(directoryTool.status, 'published')];
  if (categorySlug) {
    conditions.push(eq(directoryCategory.slug, categorySlug));
  }
  if (source) {
    conditions.push(eq(directoryTool.source, source));
  }

  let query = db()
    .select(toolSelectFields)
    .from(directoryTool)
    .leftJoin(
      directoryToolTranslation,
      and(
        eq(directoryToolTranslation.toolId, directoryTool.id),
        eq(directoryToolTranslation.locale, locale)
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
        eq(directoryCategoryTranslation.locale, locale)
      )
    )
    .$dynamic();

  if (tagSlug) {
    query = query
      .innerJoin(
        directoryToolTag,
        eq(directoryToolTag.toolId, directoryTool.id)
      )
      .innerJoin(
        directoryTag,
        and(
          eq(directoryTag.id, directoryToolTag.tagId),
          eq(directoryTag.slug, tagSlug)
        )
      );
  }

  if (collectionSlug) {
    query = query
      .innerJoin(
        directoryCollectionTool,
        eq(directoryCollectionTool.toolId, directoryTool.id)
      )
      .innerJoin(
        directoryCollection,
        and(
          eq(directoryCollection.id, directoryCollectionTool.collectionId),
          eq(directoryCollection.slug, collectionSlug),
          eq(directoryCollection.status, 'published')
        )
      );
  }

  const whereClause = and(...conditions);

  const countQuery = db()
    .select({ count: sql<number>`count(*)`.as('count') })
    .from(directoryTool)
    .leftJoin(
      directoryCategory,
      eq(directoryCategory.id, directoryTool.categoryId)
    )
    .$dynamic();

  let finalCountQuery = countQuery;
  if (tagSlug) {
    finalCountQuery = finalCountQuery
      .innerJoin(
        directoryToolTag,
        eq(directoryToolTag.toolId, directoryTool.id)
      )
      .innerJoin(
        directoryTag,
        and(
          eq(directoryTag.id, directoryToolTag.tagId),
          eq(directoryTag.slug, tagSlug)
        )
      );
  }

  if (collectionSlug) {
    finalCountQuery = finalCountQuery
      .innerJoin(
        directoryCollectionTool,
        eq(directoryCollectionTool.toolId, directoryTool.id)
      )
      .innerJoin(
        directoryCollection,
        and(
          eq(directoryCollection.id, directoryCollectionTool.collectionId),
          eq(directoryCollection.slug, collectionSlug),
          eq(directoryCollection.status, 'published')
        )
      );
  }

  const [countRow] = await finalCountQuery.where(whereClause);
  const total = Number(countRow?.count || 0);

  const sortMode = options.sort || 'recommended';
  const orderBy =
    collectionSlug && sortMode === 'recommended'
      ? [asc(directoryCollectionTool.sort), desc(featuredRankSql())]
      : sortMode === 'latest'
        ? [desc(directoryTool.publishedAt), desc(directoryTool.createdAt)]
        : sortMode === 'name'
          ? [asc(directoryToolTranslation.name)]
          : [
              desc(featuredRankSql()),
              desc(directoryTool.sponsored),
              desc(directoryTool.sort),
              desc(directoryTool.publishedAt),
            ];

  const rows = await query
    .where(whereClause)
    .orderBy(...orderBy)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    items: rows.map(mapToolRow),
    total,
    page,
    pageSize,
  };
}

/**
 * Fetch all tools for the feed page, ordered by publish date
 */
export async function getDirectoryFeed(options: {
  locale?: string;
  type?: 'all' | 'community';
}): Promise<{ items: LocalizedTool[] }> {
  const { items } = await getDirectoryTools({
    locale: options.locale,
    sort: 'latest',
    page: 1,
    pageSize: 500,
    source: options.type === 'community' ? 'community' : 'all',
  });

  return { items };
}

/**
 * Fetch homepage structured sections from real DB ordering
 */
export async function getHomepageData(locale = 'en') {
  const normLocale = normalizeLocale(locale);
  const categories = await getDirectoryCategories(normLocale);
  const tags = await getDirectoryTags(normLocale);

  const [{ items: recommended }, { items: latest }, { total }] =
    await Promise.all([
      getDirectoryTools({
        locale: normLocale,
        sort: 'recommended',
        page: 1,
        pageSize: 9,
      }),
      getDirectoryTools({
        locale: normLocale,
        sort: 'latest',
        page: 1,
        pageSize: 6,
      }),
      getDirectoryTools({
        locale: normLocale,
        page: 1,
        pageSize: 1,
      }),
    ]);

  const heroTool =
    recommended.find((t) => t.featured) || recommended[0] || null;

  const categorySectionSlugs = ['chatbots', 'coding', 'image'];
  const categorySections = (
    await Promise.all(
      categorySectionSlugs.map(async (slug) => {
        const cat = categories.find((c) => c.slug === slug);
        if (!cat) return null;
        const { items: tools } = await getDirectoryTools({
          locale: normLocale,
          categorySlug: slug,
          sort: 'recommended',
          page: 1,
          pageSize: 6,
        });
        return { category: cat, projects: tools };
      })
    )
  ).filter(Boolean) as Array<{
    category: LocalizedCategory;
    projects: LocalizedTool[];
  }>;

  // Search / category strip need a broader list; cap reasonably.
  const { items: allTools } = await getDirectoryTools({
    locale: normLocale,
    sort: 'recommended',
    page: 1,
    pageSize: 500,
  });

  return {
    totalProjects: total,
    allTools,
    categories,
    tags,
    heroTool,
    recommended,
    latest,
    categorySections,
    topPicks: recommended.slice(0, 5),
  };
}

/** Auth metadata for listing preview (?preview=1). */
export async function getDirectoryToolAuthMeta(slug: string) {
  const rows = await db()
    .select({
      id: directoryTool.id,
      status: directoryTool.status,
      submittedBy: directoryTool.submittedBy,
    })
    .from(directoryTool)
    .where(eq(directoryTool.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Fetch a single tool by slug, with tags and related tools.
 * Public pages pass the default (published only); author/admin preview uses anyStatus.
 */
export async function getDirectoryToolBySlug(
  slug: string,
  locale = 'en',
  opts?: { anyStatus?: boolean }
): Promise<LocalizedTool | null> {
  const normLocale = normalizeLocale(locale);

  const rows = await db()
    .select({
      ...toolSelectFields,
      introduction: directoryToolTranslation.introduction,
      howToUse: directoryToolTranslation.howToUse,
      features: directoryToolTranslation.features,
      useCases: directoryToolTranslation.useCases,
      faqs: directoryToolTranslation.faqs,
      pros: directoryToolTranslation.pros,
      cons: directoryToolTranslation.cons,
    })
    .from(directoryTool)
    .leftJoin(
      directoryToolTranslation,
      and(
        eq(directoryToolTranslation.toolId, directoryTool.id),
        eq(directoryToolTranslation.locale, normLocale)
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
        eq(directoryCategoryTranslation.locale, normLocale)
      )
    )
    .where(
      opts?.anyStatus
        ? eq(directoryTool.slug, slug)
        : and(
            eq(directoryTool.slug, slug),
            eq(directoryTool.status, 'published')
          )
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const tool = mapToolRow(row);
  tool.introduction = row.introduction || null;
  tool.howToUse = row.howToUse || null;
  tool.features = parseJsonValue(row.features, []);
  tool.useCases = parseJsonValue(row.useCases, []);
  tool.faqs = parseJsonValue(row.faqs, []);
  tool.pros = parseJsonValue(row.pros, []);
  tool.cons = parseJsonValue(row.cons, []);

  const tagRows = await db()
    .select({
      id: directoryTag.id,
      slug: directoryTag.slug,
      name: directoryTagTranslation.name,
      description: directoryTagTranslation.description,
    })
    .from(directoryToolTag)
    .innerJoin(directoryTag, eq(directoryTag.id, directoryToolTag.tagId))
    .leftJoin(
      directoryTagTranslation,
      and(
        eq(directoryTagTranslation.tagId, directoryTag.id),
        eq(directoryTagTranslation.locale, normLocale)
      )
    )
    .where(eq(directoryToolTag.toolId, tool.id));

  tool.tags = tagRows.map((tag: any) => ({
    id: tag.id,
    slug: tag.slug,
    name: tag.name || tag.slug,
    description: tag.description,
    projectCount: 0,
  }));

  const collectionRows = await db()
    .select({
      id: directoryCollection.id,
      slug: directoryCollection.slug,
      name: directoryCollectionTranslation.name,
      sort: directoryCollection.sort,
    })
    .from(directoryCollectionTool)
    .innerJoin(
      directoryCollection,
      and(
        eq(directoryCollection.id, directoryCollectionTool.collectionId),
        eq(directoryCollection.status, 'published')
      )
    )
    .leftJoin(
      directoryCollectionTranslation,
      and(
        eq(directoryCollectionTranslation.collectionId, directoryCollection.id),
        eq(directoryCollectionTranslation.locale, normLocale)
      )
    )
    .where(eq(directoryCollectionTool.toolId, tool.id))
    .orderBy(desc(directoryCollection.sort), asc(directoryCollection.slug));

  tool.collections = collectionRows.map((c: any) => ({
    id: c.id,
    slug: c.slug,
    name: c.name || c.slug,
  }));

  if (tool.categorySlug) {
    const { items: related } = await getDirectoryTools({
      locale: normLocale,
      categorySlug: tool.categorySlug,
      sort: 'recommended',
      page: 1,
      pageSize: 5,
    });
    tool.related = related
      .filter((item) => item.slug !== tool.slug)
      .slice(0, 4);
  } else {
    tool.related = [];
  }

  // Popular tools: globally top recommended tools excluding current tool (up to 5)
  const { items: popularCandidates } = await getDirectoryTools({
    locale: normLocale,
    sort: 'recommended',
    page: 1,
    pageSize: 10,
  });
  tool.popular = popularCandidates
    .filter((item) => item.slug !== tool.slug)
    .slice(0, 5);

  return tool;
}

export type ActiveSponsorAd = {
  id: string;
  name: string;
  tagline: string;
  url: string;
  iconUrl: string;
  tier: 'silver' | 'gold' | 'platinum';
};

/** Public placements: active ads that have not passed endsAt. */
export async function getActiveSponsorAds(
  limit = 6,
  opts?: { placement?: SponsorPlacement }
): Promise<ActiveSponsorAd[]> {
  // D1 rejects bound Date params; endsAt is timestamp_ms integer.
  const nowMs = Date.now();
  const placement = opts?.placement ?? 'detail';
  const tiers = tiersForPlacement(placement);
  const rows = await db()
    .select({
      id: directorySponsorAd.id,
      name: directorySponsorAd.name,
      tagline: directorySponsorAd.tagline,
      url: directorySponsorAd.url,
      iconUrl: directorySponsorAd.iconUrl,
      tier: directorySponsorAd.tier,
      endsAt: directorySponsorAd.endsAt,
    })
    .from(directorySponsorAd)
    .where(
      and(
        eq(directorySponsorAd.status, 'active'),
        inArray(directorySponsorAd.tier, [...tiers]),
        or(
          isNull(directorySponsorAd.endsAt),
          sql`${directorySponsorAd.endsAt} > ${nowMs}`
        )
      )
    )
    // Platinum first, then gold, then silver; newest within the same tier.
    .orderBy(
      sql`(case ${directorySponsorAd.tier}
        when 'platinum' then 0
        when 'gold' then 1
        else 2 end)`,
      desc(directorySponsorAd.startsAt)
    )
    .limit(Math.min(Math.max(1, limit), 20));

  return rows.map((r: (typeof rows)[number]) => ({
    id: r.id,
    name: r.name,
    tagline: r.tagline || '',
    url: r.url,
    iconUrl: r.iconUrl || '',
    tier: (r.tier as ActiveSponsorAd['tier']) || 'gold',
  }));
}
