/**
 * Seed / clean demo directory data for local development.
 *
 *   pnpm dir:seed
 *   pnpm dir:seed --clean
 *
 * Imports 8 categories, 15 tags, and 30 AI tools with fixed IDs.
 *
 * Safety rules (must not disturb real business data):
 * - Never delete/re-key existing categories or tags that already own a slug;
 *   reuse them and only fill missing translations.
 * - Never delete another tool that already owns a slug (community or editorial);
 *   skip that seed tool instead.
 * - Never clear categoryId / tag links on non-seed tools during --clean.
 * - --clean only removes seed-owned tool IDs (editorial + no submittedBy),
 *   then seed-owned categories/tags that nothing else still references.
 */

import { and, eq, inArray, isNull } from 'drizzle-orm';

import {
  directoryCategory,
  directoryCategoryTranslation,
  directoryCollectionTool,
  directoryTag,
  directoryTagTranslation,
  directoryTool,
  directoryToolTag,
  directoryToolTranslation,
} from '../src/config/db/schema';
import { db } from '../src/core/db';
import {
  SEED_CATEGORIES,
  SEED_CATEGORY_IDS,
  SEED_TAG_IDS,
  SEED_TAGS,
  SEED_TOOL_IDS,
  SEED_TOOLS,
} from './directory-seed-data';

const clean = process.argv.includes('--clean');

async function resolveCategoryId(
  cat: (typeof SEED_CATEGORIES)[number]
): Promise<{ id: string; ownedBySeed: boolean }> {
  const [byId] = await db()
    .select({ id: directoryCategory.id })
    .from(directoryCategory)
    .where(eq(directoryCategory.id, cat.id))
    .limit(1);
  if (byId) return { id: byId.id, ownedBySeed: true };

  const [bySlug] = await db()
    .select({ id: directoryCategory.id })
    .from(directoryCategory)
    .where(eq(directoryCategory.slug, cat.slug))
    .limit(1);
  if (bySlug) return { id: bySlug.id, ownedBySeed: false };

  await db().insert(directoryCategory).values({
    id: cat.id,
    slug: cat.slug,
    icon: cat.icon,
    sort: cat.sort,
    status: 'published',
  });
  return { id: cat.id, ownedBySeed: true };
}

async function upsertCategoryTranslations(
  categoryId: string,
  cat: (typeof SEED_CATEGORIES)[number],
  ownedBySeed: boolean
) {
  for (const locale of ['en', 'zh'] as const) {
    const name = locale === 'en' ? cat.nameEn : cat.nameZh;
    const description = locale === 'en' ? cat.descEn : cat.descZh;
    const [existing] = await db()
      .select({
        id: directoryCategoryTranslation.id,
        name: directoryCategoryTranslation.name,
        description: directoryCategoryTranslation.description,
      })
      .from(directoryCategoryTranslation)
      .where(
        and(
          eq(directoryCategoryTranslation.categoryId, categoryId),
          eq(directoryCategoryTranslation.locale, locale)
        )
      )
      .limit(1);

    if (existing) {
      // Reused business categories: never overwrite existing copy.
      if (!ownedBySeed) continue;
      await db()
        .update(directoryCategoryTranslation)
        .set({ name, description })
        .where(eq(directoryCategoryTranslation.id, existing.id));
    } else {
      await db()
        .insert(directoryCategoryTranslation)
        .values({
          id: `${categoryId}-${locale}`,
          categoryId,
          locale,
          name,
          description,
        });
    }
  }

  if (ownedBySeed) {
    await db()
      .update(directoryCategory)
      .set({
        icon: cat.icon,
        sort: cat.sort,
        status: 'published',
        slug: cat.slug,
      })
      .where(eq(directoryCategory.id, categoryId));
  }
}

async function resolveTagId(
  tag: (typeof SEED_TAGS)[number]
): Promise<{ id: string; ownedBySeed: boolean }> {
  const [byId] = await db()
    .select({ id: directoryTag.id })
    .from(directoryTag)
    .where(eq(directoryTag.id, tag.id))
    .limit(1);
  if (byId) return { id: byId.id, ownedBySeed: true };

  const [bySlug] = await db()
    .select({ id: directoryTag.id })
    .from(directoryTag)
    .where(eq(directoryTag.slug, tag.slug))
    .limit(1);
  if (bySlug) return { id: bySlug.id, ownedBySeed: false };

  await db().insert(directoryTag).values({ id: tag.id, slug: tag.slug });
  return { id: tag.id, ownedBySeed: true };
}

async function upsertTagTranslations(
  tagId: string,
  tag: (typeof SEED_TAGS)[number],
  ownedBySeed: boolean
) {
  for (const locale of ['en', 'zh'] as const) {
    const name = locale === 'en' ? tag.nameEn : tag.nameZh;
    const [existing] = await db()
      .select({ id: directoryTagTranslation.id })
      .from(directoryTagTranslation)
      .where(
        and(
          eq(directoryTagTranslation.tagId, tagId),
          eq(directoryTagTranslation.locale, locale)
        )
      )
      .limit(1);

    if (existing) {
      if (!ownedBySeed) continue;
      await db()
        .update(directoryTagTranslation)
        .set({ name })
        .where(eq(directoryTagTranslation.id, existing.id));
    } else {
      await db()
        .insert(directoryTagTranslation)
        .values({
          id: `${tagId}-${locale}`,
          tagId,
          locale,
          name,
          description: null,
        });
    }
  }
}

async function seed() {
  console.log(
    `Seeding directory demo data (${SEED_CATEGORIES.length} categories, ${SEED_TAGS.length} tags, ${SEED_TOOLS.length} tools)…`
  );

  const categoryIdBySlug = new Map<string, string>();
  let categoriesReused = 0;
  for (const cat of SEED_CATEGORIES) {
    const { id, ownedBySeed } = await resolveCategoryId(cat);
    await upsertCategoryTranslations(id, cat, ownedBySeed);
    categoryIdBySlug.set(cat.slug, id);
    if (!ownedBySeed) categoriesReused += 1;
  }
  console.log(
    `  categories: ${SEED_CATEGORIES.length} (${categoriesReused} reused existing)`
  );

  const tagIdBySlug = new Map<string, string>();
  let tagsReused = 0;
  for (const tag of SEED_TAGS) {
    const { id, ownedBySeed } = await resolveTagId(tag);
    await upsertTagTranslations(id, tag, ownedBySeed);
    tagIdBySlug.set(tag.slug, id);
    if (!ownedBySeed) tagsReused += 1;
  }
  console.log(`  tags: ${SEED_TAGS.length} (${tagsReused} reused existing)`);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const tool of SEED_TOOLS) {
    const categoryId = categoryIdBySlug.get(tool.categorySlug);
    if (!categoryId) {
      throw new Error(`Unknown category slug: ${tool.categorySlug}`);
    }

    const [bySlug] = await db()
      .select({
        id: directoryTool.id,
        source: directoryTool.source,
        submittedBy: directoryTool.submittedBy,
      })
      .from(directoryTool)
      .where(eq(directoryTool.slug, tool.slug))
      .limit(1);

    // Never steal a slug from any existing tool (submission or editorial).
    if (bySlug && bySlug.id !== tool.id) {
      console.log(
        `  skip tool ${tool.slug} (slug already owned by ${bySlug.source} tool)`
      );
      skipped += 1;
      continue;
    }

    const [existing] = await db()
      .select({
        id: directoryTool.id,
        source: directoryTool.source,
        submittedBy: directoryTool.submittedBy,
      })
      .from(directoryTool)
      .where(eq(directoryTool.id, tool.id))
      .limit(1);

    if (existing && (existing.source === 'community' || existing.submittedBy)) {
      console.log(`  skip tool ${tool.slug} (seed id is a real submission)`);
      skipped += 1;
      continue;
    }

    const screenshotsJson = tool.screenshots?.length
      ? JSON.stringify(tool.screenshots)
      : null;

    if (existing) {
      await db()
        .update(directoryTool)
        .set({
          slug: tool.slug,
          iconUrl: tool.iconUrl,
          websiteUrl: tool.websiteUrl,
          pricing: tool.pricing,
          categoryId,
          screenshots: screenshotsJson,
          source: 'editorial',
          featured: Boolean(tool.featured),
          sponsored: false,
          sort: tool.sort ?? 0,
          status: 'published',
          updatedAt: new Date(),
        })
        .where(eq(directoryTool.id, tool.id));
      updated += 1;
    } else {
      await db()
        .insert(directoryTool)
        .values({
          id: tool.id,
          slug: tool.slug,
          iconUrl: tool.iconUrl,
          websiteUrl: tool.websiteUrl,
          pricing: tool.pricing,
          authorName: null,
          categoryId,
          screenshots: screenshotsJson,
          source: 'editorial',
          plan: null,
          submittedBy: null,
          featured: Boolean(tool.featured),
          featuredUntil: null,
          sponsored: false,
          sort: tool.sort ?? 0,
          status: 'published',
          publishedAt: new Date(),
        });
      inserted += 1;
    }

    for (const locale of ['en', 'zh'] as const) {
      const name = locale === 'en' ? tool.nameEn : tool.nameZh;
      const tagline = locale === 'en' ? tool.taglineEn : tool.taglineZh;
      const [existingTr] = await db()
        .select({ id: directoryToolTranslation.id })
        .from(directoryToolTranslation)
        .where(
          and(
            eq(directoryToolTranslation.toolId, tool.id),
            eq(directoryToolTranslation.locale, locale)
          )
        )
        .limit(1);

      if (existingTr) {
        await db()
          .update(directoryToolTranslation)
          .set({ name, tagline })
          .where(eq(directoryToolTranslation.id, existingTr.id));
      } else {
        await db()
          .insert(directoryToolTranslation)
          .values({
            id: `${tool.id}-${locale}`,
            toolId: tool.id,
            locale,
            name,
            tagline,
            introduction: null,
          });
      }
    }

    await db()
      .delete(directoryToolTag)
      .where(eq(directoryToolTag.toolId, tool.id));

    const tagIds = tool.tagSlugs
      .map((slug) => tagIdBySlug.get(slug))
      .filter(Boolean) as string[];
    if (tagIds.length) {
      await db()
        .insert(directoryToolTag)
        .values(tagIds.map((tagId) => ({ toolId: tool.id, tagId })))
        .onConflictDoNothing();
    }
  }

  console.log(
    `  tools: +${inserted} new, ~${updated} updated, ${skipped} skipped`
  );
  console.log('Done.');
}

async function cleanSeed() {
  console.log('Cleaning directory seed data (real submissions kept)…');

  // 1) Remove only seed-owned demo tools.
  const removableTools = await db()
    .select({ id: directoryTool.id })
    .from(directoryTool)
    .where(
      and(
        inArray(directoryTool.id, SEED_TOOL_IDS),
        eq(directoryTool.source, 'editorial'),
        isNull(directoryTool.submittedBy)
      )
    );
  const toolIds = removableTools.map((t: any) => t.id as string);

  if (toolIds.length) {
    await db()
      .delete(directoryCollectionTool)
      .where(inArray(directoryCollectionTool.toolId, toolIds));
    await db()
      .delete(directoryToolTag)
      .where(inArray(directoryToolTag.toolId, toolIds));
    await db()
      .delete(directoryToolTranslation)
      .where(inArray(directoryToolTranslation.toolId, toolIds));
    await db().delete(directoryTool).where(inArray(directoryTool.id, toolIds));
  }
  console.log(`  tools removed: ${toolIds.length}`);

  // 2) Remove seed-owned tags only when nothing still links to them.
  //    Do not strip tag links from other tools.
  const tagsStillUsed = await db()
    .select({ tagId: directoryToolTag.tagId })
    .from(directoryToolTag)
    .where(inArray(directoryToolTag.tagId, SEED_TAG_IDS));
  const usedTagIds = new Set(tagsStillUsed.map((r: any) => r.tagId as string));
  const removableTagIds = SEED_TAG_IDS.filter((id) => !usedTagIds.has(id));

  if (removableTagIds.length) {
    await db()
      .delete(directoryTagTranslation)
      .where(inArray(directoryTagTranslation.tagId, removableTagIds));
    await db()
      .delete(directoryTag)
      .where(inArray(directoryTag.id, removableTagIds));
  }
  console.log(
    `  tags removed: ${removableTagIds.length}` +
      (usedTagIds.size ? ` (${usedTagIds.size} kept — still linked)` : '')
  );

  // 3) Remove seed-owned categories only when nothing still points at them.
  //    Do not null out other tools' categoryId.
  const catsStillUsed = await db()
    .select({ categoryId: directoryTool.categoryId })
    .from(directoryTool)
    .where(inArray(directoryTool.categoryId, SEED_CATEGORY_IDS));
  const usedCatIds = new Set(
    catsStillUsed
      .map((r: any) => r.categoryId as string | null)
      .filter(Boolean) as string[]
  );
  const removableCatIds = SEED_CATEGORY_IDS.filter((id) => !usedCatIds.has(id));

  if (removableCatIds.length) {
    await db()
      .delete(directoryCategoryTranslation)
      .where(inArray(directoryCategoryTranslation.categoryId, removableCatIds));
    await db()
      .delete(directoryCategory)
      .where(inArray(directoryCategory.id, removableCatIds));
  }
  console.log(
    `  categories removed: ${removableCatIds.length}` +
      (usedCatIds.size ? ` (${usedCatIds.size} kept — still linked)` : '')
  );
  console.log('Done.');
}

async function main() {
  if (clean) {
    await cleanSeed();
  } else {
    await seed();
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
