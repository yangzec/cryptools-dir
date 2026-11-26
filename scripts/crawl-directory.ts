import vm from 'node:vm';
import { eq } from 'drizzle-orm';

import {
  directoryCategory,
  directoryCategoryTranslation,
  directoryTag,
  directoryTagTranslation,
  directoryTool,
  directoryToolTag,
  directoryToolTranslation,
} from '../src/config/db/schema';
import { db } from '../src/core/db';
import { getStorage } from '../src/modules/storage/service';

/**
 * Sync directory data from the live site into local DB.
 *
 *   pnpm dir:crawl -- --content-only
 *   pnpm dir:crawl -- --content-only --slug=perplexity,chatgpt
 *
 * --content-only  Only refresh tool translation detail fields (intro/features/…).
 *                 Keeps local iconUrl/screenshots untouched; skips category/tag
 *                 crawl and R2 uploads. Uses local DB slugs (or --slug=).
 * --slug=a,b      Limit to these tool slugs.
 */

const BASE_URL = 'https://dir.shipany.site';
// Low frequency to avoid rate limits on the live site.
const SLEEP_MS = 2800;
const SLEEP_JITTER_MS = 900;

const contentOnly = process.argv.includes('--content-only');
const slugArg = process.argv.find((a) => a.startsWith('--slug='));
const slugFilter = slugArg
  ? slugArg
      .slice('--slug='.length)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : null;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function politeSleep() {
  const jitter = Math.floor(Math.random() * SLEEP_JITTER_MS);
  await sleep(SLEEP_MS + jitter);
}

function isStoredAssetUrl(url?: string | null) {
  if (!url) return false;
  return (
    url.startsWith('/imgs/') ||
    url.includes('dir-oss.') ||
    url.includes('/uploads/') ||
    url.includes('r2.dev') ||
    url.includes('cloudflarestorage.com')
  );
}

function hasStoredScreenshots(raw?: string | null) {
  if (!raw) return false;
  try {
    const list = JSON.parse(raw);
    return (
      Array.isArray(list) &&
      list.length > 0 &&
      list.every((u) => typeof u === 'string' && isStoredAssetUrl(u))
    );
  } catch {
    return isStoredAssetUrl(raw);
  }
}

/**
 * Extracts TanStack Router SSR data from HTML response
 */
function extractTsrData(html: string) {
  const scripts = [
    ...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g),
  ].map((m) => m[1]);

  const routerScript = scripts.find((s) => s.includes('$_TSR.router'));
  if (!routerScript) return null;

  const dummyEl = { previousElementSibling: null, remove() {} };
  const ctx: any = {
    Date,
    document: { currentScript: dummyEl },
  };
  ctx.self = ctx;
  ctx.window = ctx;
  ctx.global = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);

  const initScript = scripts.find((s) => s.includes('self.$_TSR='));
  if (initScript && initScript !== routerScript) {
    vm.runInContext(initScript, ctx);
  }
  vm.runInContext(routerScript, ctx);

  const router =
    typeof ctx.$_TSR.router === 'function'
      ? ctx.$_TSR.router(ctx.$R)
      : ctx.$_TSR.router;

  return router?.matches || [];
}

async function fetchPageTsr(path: string) {
  const url = `${BASE_URL}${path}`;
  console.log(`[Fetch] ${url}`);
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  const html = await res.text();
  const matches = extractTsrData(html);
  await politeSleep();
  return matches;
}

/**
 * Uploads an external image to R2 through StorageManager
 */
async function uploadImageToR2(
  storage: any,
  imageUrl: string,
  key: string
): Promise<string> {
  if (!storage) return imageUrl;
  try {
    const fullUrl = imageUrl.startsWith('http')
      ? imageUrl
      : `${BASE_URL}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;

    const res = await fetch(fullUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
      },
    });
    if (!res.ok) {
      console.warn(
        `[Image] Failed to download ${fullUrl} (${res.status}), keeping original`
      );
      return imageUrl;
    }

    const arrayBuffer = await res.arrayBuffer();
    const body = Buffer.from(arrayBuffer);
    const contentType =
      res.headers.get('content-type') ||
      (key.endsWith('.png') ? 'image/png' : 'image/jpeg');

    const result = await storage.uploadFile({
      body,
      key,
      contentType,
      disposition: 'inline',
    });

    if (result.success && result.url) {
      return result.url;
    }
    console.warn(`[Image] R2 upload failed for ${key}: ${result.error}`);
    return imageUrl;
  } catch (err: any) {
    console.warn(
      `[Image] Error uploading ${imageUrl} to ${key}: ${err.message}`
    );
    return imageUrl;
  }
}

async function main() {
  console.log('=== Starting ShipAny Directory Crawl & Ingestion ===');
  const storage = await getStorage();
  console.log('[Storage] Storage configured:', Boolean(storage));

  // 1. Fetch Categories
  console.log('\n--- 1. Processing Categories ---');
  const catEnMatches = await fetchPageTsr('/categories');
  const catEnData = catEnMatches?.find((m: any) =>
    m.i?.includes('categories')
  )?.l;
  const catZhMatches = await fetchPageTsr('/zh/categories');
  const catZhData = catZhMatches?.find((m: any) =>
    m.i?.includes('categories')
  )?.l;

  if (Array.isArray(catEnData)) {
    for (const cat of catEnData) {
      const zhCat = Array.isArray(catZhData)
        ? catZhData.find((c: any) => c.slug === cat.slug)
        : null;

      // Upsert Category
      await db()
        .insert(directoryCategory)
        .values({
          id: cat.id,
          slug: cat.slug,
          icon: cat.icon || null,
          sort: cat.sort || 0,
          status: cat.status || 'published',
          createdAt: new Date(cat.createdAt || Date.now()),
          updatedAt: new Date(cat.updatedAt || Date.now()),
        })
        .onConflictDoUpdate({
          target: directoryCategory.id,
          set: {
            slug: cat.slug,
            icon: cat.icon || null,
            sort: cat.sort || 0,
            status: cat.status || 'published',
            updatedAt: new Date(cat.updatedAt || Date.now()),
          },
        });

      // Upsert EN Translation
      await db()
        .insert(directoryCategoryTranslation)
        .values({
          id: `${cat.id}-en`,
          categoryId: cat.id,
          locale: 'en',
          name: cat.name,
          description: cat.description || null,
          createdAt: new Date(),
        })
        .onConflictDoUpdate({
          target: directoryCategoryTranslation.id,
          set: {
            name: cat.name,
            description: cat.description || null,
          },
        });

      // Upsert ZH Translation
      if (zhCat) {
        await db()
          .insert(directoryCategoryTranslation)
          .values({
            id: `${cat.id}-zh`,
            categoryId: cat.id,
            locale: 'zh',
            name: zhCat.name,
            description: zhCat.description || null,
            createdAt: new Date(),
          })
          .onConflictDoUpdate({
            target: directoryCategoryTranslation.id,
            set: {
              name: zhCat.name,
              description: zhCat.description || null,
            },
          });
      }
      console.log(
        `[Category] Saved: ${cat.slug} (${cat.name} / ${zhCat?.name || cat.name})`
      );
    }
  }

  // 2. Fetch Tags
  console.log('\n--- 2. Processing Tags ---');
  const tagEnMatches = await fetchPageTsr('/tags');
  const tagEnData = tagEnMatches?.find((m: any) => m.i?.includes('tags'))?.l;
  const tagZhMatches = await fetchPageTsr('/zh/tags');
  const tagZhData = tagZhMatches?.find((m: any) => m.i?.includes('tags'))?.l;

  if (Array.isArray(tagEnData)) {
    for (const tag of tagEnData) {
      const zhTag = Array.isArray(tagZhData)
        ? tagZhData.find((t: any) => t.slug === tag.slug)
        : null;

      // Upsert Tag
      await db()
        .insert(directoryTag)
        .values({
          id: tag.id,
          slug: tag.slug,
          createdAt: new Date(tag.createdAt || Date.now()),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: directoryTag.id,
          set: {
            slug: tag.slug,
            updatedAt: new Date(),
          },
        });

      // Upsert EN Tag Translation
      await db()
        .insert(directoryTagTranslation)
        .values({
          id: `${tag.id}-en`,
          tagId: tag.id,
          locale: 'en',
          name: tag.name,
          description: tag.description || null,
          createdAt: new Date(),
        })
        .onConflictDoUpdate({
          target: directoryTagTranslation.id,
          set: {
            name: tag.name,
            description: tag.description || null,
          },
        });

      // Upsert ZH Tag Translation
      if (zhTag) {
        await db()
          .insert(directoryTagTranslation)
          .values({
            id: `${tag.id}-zh`,
            tagId: tag.id,
            locale: 'zh',
            name: zhTag.name,
            description: zhTag.description || null,
            createdAt: new Date(),
          })
          .onConflictDoUpdate({
            target: directoryTagTranslation.id,
            set: {
              name: zhTag.name,
              description: zhTag.description || null,
            },
          });
      }
      console.log(
        `[Tag] Saved: #${tag.slug} (${tag.name} / ${zhTag?.name || tag.name})`
      );
    }
  }

  // 3. Fetch All Tool Slugs (paginate until empty)
  console.log('\n--- 3. Collecting Tool Slugs ---');
  const toolSlugs: string[] = [];
  for (let page = 1; page <= 50; page++) {
    const matches = await fetchPageTsr(`/tools?page=${page}`);
    const pageData = matches?.find((m: any) =>
      m.i?.includes('tools##tools')
    )?.l;
    const items = pageData?.items;
    if (!Array.isArray(items) || items.length === 0) break;
    items.forEach((item: any) => {
      if (item?.slug) toolSlugs.push(item.slug);
    });
    const totalPages = Number(pageData?.totalPages || pageData?.pageCount || 0);
    if (totalPages && page >= totalPages) break;
    if (items.length < 24) break;
  }

  console.log(`[Tools] Found ${toolSlugs.length} tools to crawl and ingest.`);

  // 4. Ingest Each Tool Detail (EN & ZH)
  console.log('\n--- 4. Crawling Tool Details & Uploading Images ---');
  let toolIndex = 0;
  for (const slug of toolSlugs) {
    toolIndex++;
    console.log(
      `\n[${toolIndex}/${toolSlugs.length}] Processing tool: ${slug}`
    );

    const enMatch = (await fetchPageTsr(`/tools/${slug}`))?.find((m: any) =>
      m.i?.includes('tools#$slug')
    );
    const enLoader = enMatch?.l;
    const enProject = enLoader?.project;

    const zhMatch = (await fetchPageTsr(`/zh/tools/${slug}`))?.find((m: any) =>
      m.i?.includes('tools#$slug')
    );
    const zhProject = zhMatch?.l?.project;

    if (!enProject) {
      console.error(`[Error] Could not find project data for ${slug}`);
      continue;
    }

    const existingRows = await db()
      .select({
        iconUrl: directoryTool.iconUrl,
        screenshots: directoryTool.screenshots,
      })
      .from(directoryTool)
      .where(eq(directoryTool.id, enProject.id))
      .limit(1);
    const existing = existingRows[0];

    // Reuse stored assets when already uploaded — avoids extra downloads.
    let iconUrl = existing?.iconUrl || enProject.iconUrl;
    if (iconUrl && !isStoredAssetUrl(iconUrl)) {
      const ext = iconUrl.includes('.svg') ? 'svg' : 'png';
      iconUrl = await uploadImageToR2(storage, iconUrl, `icons/${slug}.${ext}`);
      console.log(`  - Icon R2 URL: ${iconUrl}`);
    } else if (isStoredAssetUrl(iconUrl)) {
      console.log(`  - Keep existing icon: ${iconUrl}`);
    }

    let screenshotsStr: string | null = existing?.screenshots || null;
    if (isStoredAssetUrl(screenshotsStr || undefined)) {
      console.log('  - Keep existing screenshots');
    } else if (enProject.screenshots) {
      try {
        const rawScreenshots: string[] = JSON.parse(enProject.screenshots);
        const r2Screenshots: string[] = [];
        for (let idx = 0; idx < rawScreenshots.length; idx++) {
          const rawUrl = rawScreenshots[idx];
          const ext = rawUrl.endsWith('.png') ? 'png' : 'jpg';
          const r2Url = await uploadImageToR2(
            storage,
            rawUrl,
            `screenshots/${slug}-${idx + 1}.${ext}`
          );
          r2Screenshots.push(r2Url);
        }
        screenshotsStr = JSON.stringify(r2Screenshots);
        console.log(`  - Uploaded ${r2Screenshots.length} screenshots to R2`);
      } catch (err: any) {
        console.warn(`  - Failed to parse screenshots: ${err.message}`);
        screenshotsStr = enProject.screenshots;
      }
    }

    // Determine featured & sponsored
    const FEATURED_SLUGS = new Set([
      'chatgpt',
      'claude',
      'cursor',
      'midjourney',
      'runway',
      'elevenlabs',
      'gamma',
      'perplexity',
    ]);
    const isFeatured = Boolean(
      enProject.featured ||
      enProject.badgeRev > 0 ||
      FEATURED_SLUGS.has(enProject.slug)
    );
    const isSponsored = Boolean(enProject.sponsored);
    const source =
      enProject.source === 'community' ||
      enProject.isCommunity === true ||
      enProject.userSubmitted === true ||
      Boolean(enProject.submittedBy)
        ? 'community'
        : 'editorial';

    // Upsert Tool Base Record
    await db()
      .insert(directoryTool)
      .values({
        id: enProject.id,
        slug: enProject.slug,
        iconUrl,
        websiteUrl: enProject.websiteUrl || null,
        pricing: enProject.pricing || 'free',
        authorName: enProject.authorName || null,
        categoryId: enProject.categoryId || null,
        screenshots: screenshotsStr,
        source,
        featured: isFeatured,
        sponsored: isSponsored,
        sort: enProject.sort || 0,
        status: enProject.status || 'published',
        publishedAt: enProject.publishedAt
          ? new Date(enProject.publishedAt)
          : new Date(),
        createdAt: enProject.createdAt
          ? new Date(enProject.createdAt)
          : new Date(),
        updatedAt: enProject.updatedAt
          ? new Date(enProject.updatedAt)
          : new Date(),
      })
      .onConflictDoUpdate({
        target: directoryTool.id,
        set: {
          slug: enProject.slug,
          iconUrl,
          websiteUrl: enProject.websiteUrl || null,
          pricing: enProject.pricing || 'free',
          authorName: enProject.authorName || null,
          categoryId: enProject.categoryId || null,
          screenshots: screenshotsStr,
          source,
          featured: isFeatured,
          sponsored: isSponsored,
          sort: enProject.sort || 0,
          status: enProject.status || 'published',
          updatedAt: new Date(),
        },
      });

    // Tags live on loader.l.tags (not project.tags)
    const rawTags: any[] = Array.isArray(enLoader?.tags) ? enLoader.tags : [];
    let tagLinkCount = 0;
    for (const tag of rawTags) {
      const tagId = typeof tag === 'string' ? tag : tag?.id;
      if (!tagId) continue;
      await db()
        .insert(directoryToolTag)
        .values({
          toolId: enProject.id,
          tagId,
        })
        .onConflictDoNothing();
      tagLinkCount += 1;
    }
    console.log(`  - Linked ${tagLinkCount} tags (source=${source})`);

    // Upsert EN Translation
    await db()
      .insert(directoryToolTranslation)
      .values({
        id: `${enProject.id}-en`,
        toolId: enProject.id,
        locale: 'en',
        name: enProject.name,
        tagline: enProject.tagline || null,
        introduction: enProject.introduction || null,
        howToUse: enProject.howToUse || null,
        features: enProject.features || null,
        useCases: enProject.useCases || null,
        faqs: enProject.faqs || null,
        pros: enProject.pros || null,
        cons: enProject.cons || null,
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: directoryToolTranslation.id,
        set: {
          name: enProject.name,
          tagline: enProject.tagline || null,
          introduction: enProject.introduction || null,
          howToUse: enProject.howToUse || null,
          features: enProject.features || null,
          useCases: enProject.useCases || null,
          faqs: enProject.faqs || null,
          pros: enProject.pros || null,
          cons: enProject.cons || null,
        },
      });

    // Upsert ZH Translation
    if (zhProject) {
      await db()
        .insert(directoryToolTranslation)
        .values({
          id: `${enProject.id}-zh`,
          toolId: enProject.id,
          locale: 'zh',
          name: zhProject.name || enProject.name,
          tagline: zhProject.tagline || enProject.tagline || null,
          introduction: zhProject.introduction || null,
          howToUse: zhProject.howToUse || null,
          features: zhProject.features || null,
          useCases: zhProject.useCases || null,
          faqs: zhProject.faqs || null,
          pros: zhProject.pros || null,
          cons: zhProject.cons || null,
          createdAt: new Date(),
        })
        .onConflictDoUpdate({
          target: directoryToolTranslation.id,
          set: {
            name: zhProject.name || enProject.name,
            tagline: zhProject.tagline || enProject.tagline || null,
            introduction: zhProject.introduction || null,
            howToUse: zhProject.howToUse || null,
            features: zhProject.features || null,
            useCases: zhProject.useCases || null,
            faqs: zhProject.faqs || null,
            pros: zhProject.pros || null,
            cons: zhProject.cons || null,
          },
        });
    }

    console.log(`  ✓ Saved tool & translations for ${slug}`);
  }

  console.log('\n=== Ingestion Completed Successfully! ===');
}

main().catch((err) => {
  console.error('[Fatal Error]', err);
  process.exit(1);
});
