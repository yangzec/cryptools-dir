/**
 * Sync local directory tool detail copy (+ public screenshots/icons) from the live site.
 *
 *   pnpm dir:sync
 *   pnpm dir:sync -- --slug=perplexity
 *   pnpm dir:sync -- --slug=chatgpt,claude
 *
 * Uses local DB slugs by default (no tools listing crawl).
 * Polite delay between page fetches to avoid rate limits.
 * Does NOT change featured / sort / sponsored.
 * Does NOT upload to R2 — writes under public/imgs/.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { eq } from 'drizzle-orm';

import {
  directoryTool,
  directoryToolTag,
  directoryToolTranslation,
} from '../src/config/db/schema';
import { db } from '../src/core/db';

const BASE_URL = 'https://dir.shipany.site';
const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const SLEEP_MS = 2800;
const SLEEP_JITTER_MS = 900;
const IMAGE_SLEEP_MS = 400;

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
  await sleep(SLEEP_MS + Math.floor(Math.random() * SLEEP_JITTER_MS));
}

function isLocalPublicPath(url?: string | null) {
  return Boolean(url && url.startsWith('/imgs/'));
}

function absoluteAssetUrl(url: string) {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${BASE_URL}${url}`;
  return `${BASE_URL}/${url}`;
}

function parseScreenshotList(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((u) => typeof u === 'string');
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.filter((u) => typeof u === 'string')
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

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

async function fetchPageTsr(pagePath: string) {
  const url = `${BASE_URL}${pagePath}`;
  console.log(`[Fetch] ${url}`);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'ShipAnyDirLocalSync/1.0 (+local-dev content sync)',
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

async function downloadToPublic(
  remoteUrl: string,
  publicRelPath: string
): Promise<string | null> {
  const abs = path.join(PUBLIC_DIR, publicRelPath.replace(/^\//, ''));
  await fs.mkdir(path.dirname(abs), { recursive: true });

  try {
    const res = await fetch(absoluteAssetUrl(remoteUrl), {
      headers: {
        'User-Agent': 'ShipAnyDirLocalSync/1.0 (+local-dev asset sync)',
      },
    });
    if (!res.ok) {
      console.warn(`  - skip image ${remoteUrl} (${res.status})`);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(abs, buf);
    await sleep(IMAGE_SLEEP_MS);
    return publicRelPath.startsWith('/') ? publicRelPath : `/${publicRelPath}`;
  } catch (err: any) {
    console.warn(`  - image error ${remoteUrl}: ${err.message}`);
    return null;
  }
}

function localScreenshotPath(slug: string, index: number, srcUrl: string) {
  const ext = srcUrl.toLowerCase().includes('.png') ? 'png' : 'jpg';
  if (index === 0) return `/imgs/screenshots/${slug}.${ext}`;
  return `/imgs/screenshots/${slug}-${index + 1}.${ext}`;
}

function localIconPath(slug: string, srcUrl: string) {
  const ext = srcUrl.toLowerCase().includes('.svg')
    ? 'svg'
    : srcUrl.toLowerCase().includes('.jpg') ||
        srcUrl.toLowerCase().includes('.jpeg')
      ? 'jpg'
      : 'png';
  return `/imgs/icons/${slug}.${ext}`;
}

async function syncTool(slug: string) {
  console.log(`\n[Tool] ${slug}`);

  const enMatch = (await fetchPageTsr(`/tools/${slug}`))?.find((m: any) =>
    String(m.i || '').includes('tools#$slug')
  );
  const enLoader = enMatch?.l;
  const enProject = enLoader?.project;

  const zhMatch = (await fetchPageTsr(`/zh/tools/${slug}`))?.find((m: any) =>
    String(m.i || '').includes('tools#$slug')
  );
  const zhProject = zhMatch?.l?.project;

  if (!enProject?.id) {
    console.error(`  ! no live project for ${slug}`);
    return;
  }

  const [existing] = await db()
    .select({
      id: directoryTool.id,
      iconUrl: directoryTool.iconUrl,
      screenshots: directoryTool.screenshots,
    })
    .from(directoryTool)
    .where(eq(directoryTool.slug, slug))
    .limit(1);

  const toolId = existing?.id || enProject.id;

  // Screenshots → public/imgs/screenshots
  const remoteShots = parseScreenshotList(enProject.screenshots);
  const localShots: string[] = [];
  for (let i = 0; i < remoteShots.length; i++) {
    const src = remoteShots[i];
    // Prefer live /imgs path basename when already local-style
    const dest =
      isLocalPublicPath(src) && src.includes('/screenshots/')
        ? src.replace(/\.(webp)$/i, '.jpg')
        : localScreenshotPath(slug, i, src);
    const saved = await downloadToPublic(src, dest);
    if (saved) localShots.push(saved);
  }
  if (localShots.length) {
    console.log(`  - screenshots: ${localShots.join(', ')}`);
  } else {
    console.log('  - screenshots: (none on live)');
  }

  // Icon → keep existing /imgs/icons; else download live /imgs icon; else leave as-is
  let iconUrl = existing?.iconUrl || enProject.iconUrl || null;
  const liveIcon = enProject.iconUrl as string | null | undefined;
  if (isLocalPublicPath(existing?.iconUrl)) {
    iconUrl = existing!.iconUrl;
    console.log(`  - icon keep local: ${iconUrl}`);
  } else if (isLocalPublicPath(liveIcon)) {
    const saved = await downloadToPublic(liveIcon!, liveIcon!);
    iconUrl = saved || liveIcon!;
    console.log(`  - icon from live public: ${iconUrl}`);
  } else if (liveIcon && !isLocalPublicPath(liveIcon)) {
    // Optional: mirror remote/favicon into public only when no local icon yet
    const dest = localIconPath(slug, liveIcon);
    const abs = path.join(PUBLIC_DIR, dest.replace(/^\//, ''));
    try {
      await fs.access(abs);
      iconUrl = dest;
      console.log(`  - icon already on disk: ${iconUrl}`);
    } catch {
      // Don't download google favicons as "icons" — keep URL; local seed icons stay if present
      iconUrl = existing?.iconUrl || liveIcon;
      console.log(`  - icon leave remote/favicon: ${iconUrl}`);
    }
  }

  const screenshotsJson = localShots.length
    ? JSON.stringify(localShots)
    : existing?.screenshots || null;

  const publishedAt = enProject.publishedAt
    ? new Date(enProject.publishedAt)
    : undefined;

  if (existing) {
    await db()
      .update(directoryTool)
      .set({
        websiteUrl: enProject.websiteUrl || null,
        pricing: enProject.pricing || 'free',
        authorName: enProject.authorName || null,
        categoryId: enProject.categoryId || null,
        iconUrl,
        screenshots: screenshotsJson,
        ...(publishedAt ? { publishedAt } : {}),
        updatedAt: new Date(),
      })
      .where(eq(directoryTool.id, toolId));
  } else {
    await db()
      .insert(directoryTool)
      .values({
        id: toolId,
        slug: enProject.slug,
        iconUrl,
        websiteUrl: enProject.websiteUrl || null,
        pricing: enProject.pricing || 'free',
        authorName: enProject.authorName || null,
        categoryId: enProject.categoryId || null,
        screenshots: screenshotsJson,
        source: 'editorial',
        featured: Boolean(enProject.featured),
        sponsored: Boolean(enProject.sponsored),
        sort: enProject.sort || 0,
        status: enProject.status || 'published',
        publishedAt: publishedAt || new Date(),
      });
  }

  await db()
    .insert(directoryToolTranslation)
    .values({
      id: `${toolId}-en`,
      toolId,
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

  if (zhProject) {
    await db()
      .insert(directoryToolTranslation)
      .values({
        id: `${toolId}-zh`,
        toolId,
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

  // Tag ids on live may not exist locally — skip missing FKs.
  const rawTags: any[] = Array.isArray(enLoader?.tags) ? enLoader.tags : [];
  let tagOk = 0;
  for (const tag of rawTags) {
    const tagId = typeof tag === 'string' ? tag : tag?.id;
    if (!tagId) continue;
    try {
      await db()
        .insert(directoryToolTag)
        .values({ toolId, tagId })
        .onConflictDoNothing();
      tagOk += 1;
    } catch {
      // ignore missing tag FK
    }
  }

  const contentBits = [
    enProject.introduction,
    enProject.howToUse,
    enProject.features,
    enProject.useCases,
    enProject.faqs,
    enProject.pros,
    enProject.cons,
  ].filter(Boolean).length;
  console.log(
    `  ✓ content fields=${contentBits}, tags linked=${tagOk}/${rawTags.length}`
  );
}

async function main() {
  console.log(
    '=== Sync directory details from live (content + public imgs) ==='
  );
  if (slugFilter?.length) {
    console.log(`Slug filter: ${slugFilter.join(', ')}`);
  }

  // Backup hint path (caller may also snapshot); create quick sqlite copy
  const bakDir = path.resolve(process.cwd(), 'data/backups');
  await fs.mkdir(bakDir, { recursive: true });
  const dbFile = path.resolve(process.cwd(), 'data/local.db');
  const stamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14);
  try {
    await fs.copyFile(
      dbFile,
      path.join(bakDir, `local.db.${stamp}-pre-sync.bak`)
    );
    console.log(`DB backup: data/backups/local.db.${stamp}-pre-sync.bak`);
  } catch (err: any) {
    console.warn(`DB backup skipped: ${err.message}`);
  }

  let slugs: string[];
  if (slugFilter?.length) {
    slugs = slugFilter;
  } else {
    const rows = await db()
      .select({ slug: directoryTool.slug })
      .from(directoryTool);
    slugs = rows.map((r: { slug: string }) => r.slug).sort();
  }

  console.log(`Tools to sync: ${slugs.length}`);
  let i = 0;
  for (const slug of slugs) {
    i += 1;
    console.log(`\n—— ${i}/${slugs.length} ——`);
    try {
      await syncTool(slug);
    } catch (err: any) {
      console.error(`[Error] ${slug}: ${err.message}`);
      await politeSleep();
    }
  }

  console.log('\n=== Sync finished ===');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
