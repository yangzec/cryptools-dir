/**
 * Admin directory create/edit EN+ZH persistence.
 *
 * 1) Client toPayload / toEditPayload: clearable fields always send '' (not
 *    undefined), edit omits locked slug (and tool source/status).
 * 2) Server admin upserts: create with EN+ZH, update both locales, clear ZH
 *    name deletes zh row, clear EN optional fields store null.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, test } from 'node:test';
import { eq } from 'drizzle-orm';

const directory = await mkdtemp(join(tmpdir(), 'shipany-dir-admin-i18n-'));
Object.assign(process.env, {
  DATABASE_PROVIDER: 'sqlite',
  DATABASE_URL: `file:${directory}/test.db`,
  AUTH_SECRET: 'isolated-dir-admin-i18n-test-secret-not-a-real-credential',
  NODE_ENV: 'test',
  VITE_APP_URL: 'http://localhost:3000',
});
execFileSync(
  process.execPath,
  [
    'node_modules/drizzle-kit/bin.cjs',
    'push',
    '--dialect=sqlite',
    '--schema=./src/config/db/schema.sqlite.ts',
    `--url=${process.env.DATABASE_URL}`,
    '--force',
  ],
  { stdio: 'pipe', env: process.env }
);

const { db } = await import('../src/core/db');
const {
  directoryCategoryTranslation,
  directoryCollectionTranslation,
  directoryTagTranslation,
  directoryToolTranslation,
} = await import('../src/config/db/schema');
const admin = await import('../src/modules/directory/admin');

const toolsShared =
  await import('../src/routes/admin/directory/-tools-shared.tsx');
const categoriesForm =
  await import('../src/routes/admin/directory/-categories-form.tsx');
const collectionsForm =
  await import('../src/routes/admin/directory/-collections-form.tsx');
const tagsPage = await import('../src/routes/admin/directory/tags.tsx');

after(async () => {
  await rm(directory, { recursive: true, force: true });
});

function assertJsonKeepsEmptyStrings(payload: Record<string, unknown>) {
  const raw = JSON.stringify(payload);
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  for (const [key, value] of Object.entries(payload)) {
    if (value === '') {
      assert.equal(
        parsed[key],
        '',
        `JSON round-trip must keep empty string for ${key}`
      );
    }
    if (value === undefined) {
      assert.equal(key in parsed, false, `JSON must omit undefined key ${key}`);
    }
  }
  return parsed;
}

describe('toPayload / toEditPayload (client)', () => {
  test('tools: create payload keeps EN+ZH empties as strings', () => {
    const payload = toolsShared.toPayload({
      ...toolsShared.emptyForm,
      name: 'Acme',
      tagline: '  ',
      introduction: '',
      nameZh: ' 艾克米 ',
      taglineZh: '',
      introductionZh: '简介',
      slug: ' acme ',
    });
    assert.equal(payload.name, 'Acme');
    assert.equal(payload.tagline, '');
    assert.equal(payload.introduction, '');
    assert.equal(payload.nameZh, '艾克米');
    assert.equal(payload.taglineZh, '');
    assert.equal(payload.introductionZh, '简介');
    assert.equal(payload.slug, 'acme');
    assertJsonKeepsEmptyStrings(payload as Record<string, unknown>);
  });

  test('tools: toEditPayload omits slug/source/status and still sends clears', () => {
    const edit = toolsShared.toEditPayload({
      ...toolsShared.emptyForm,
      name: 'Acme',
      tagline: '',
      introduction: 'kept',
      nameZh: '',
      taglineZh: '',
      introductionZh: '',
      websiteUrl: '',
      iconUrl: '',
      authorName: '',
      slug: 'acme',
      source: 'community',
      status: 'published',
    });
    assert.equal('slug' in edit, false);
    assert.equal('source' in edit, false);
    assert.equal('status' in edit, false);
    assert.equal(edit.tagline, '');
    assert.equal(edit.nameZh, '');
    assert.equal(edit.introduction, 'kept');
    assert.equal(edit.websiteUrl, '');
    assert.equal(edit.iconUrl, '');
    assert.equal(edit.authorName, '');
    assertJsonKeepsEmptyStrings(edit as Record<string, unknown>);
  });

  test('categories: payload always sends description + zh strings', () => {
    const payload = categoriesForm.toPayload({
      ...categoriesForm.emptyForm,
      name: 'Coding',
      description: '',
      nameZh: '编程',
      descriptionZh: '',
      slug: 'coding',
    });
    assert.equal(payload.description, '');
    assert.equal(payload.descriptionZh, '');
    assert.equal(payload.nameZh, '编程');
    const edit = categoriesForm.toEditPayload({
      ...categoriesForm.emptyForm,
      name: 'Coding',
      description: 'x',
      nameZh: '',
      descriptionZh: 'y',
      slug: 'coding',
    });
    assert.equal('slug' in edit, false);
    assert.equal(edit.nameZh, '');
    assert.equal(edit.descriptionZh, 'y');
    assertJsonKeepsEmptyStrings(payload as Record<string, unknown>);
  });

  test('collections: payload always sends description + zh strings', () => {
    const payload = collectionsForm.toPayload({
      ...collectionsForm.emptyForm,
      name: 'Best of',
      description: '',
      nameZh: '',
      descriptionZh: '',
      slug: 'best',
    });
    assert.equal(payload.description, '');
    assert.equal(payload.nameZh, '');
    assert.equal(payload.descriptionZh, '');
    const edit = collectionsForm.toEditPayload({
      ...collectionsForm.emptyForm,
      name: 'Best of',
      description: 'd',
      nameZh: '精选',
      descriptionZh: '',
      slug: 'best',
    });
    assert.equal('slug' in edit, false);
    assert.equal(edit.descriptionZh, '');
    assert.equal(edit.nameZh, '精选');
  });

  test('tags: payload always sends description + zh strings; edit omits slug', () => {
    const payload = tagsPage.toPayload({
      ...tagsPage.emptyForm,
      name: 'AI',
      description: '',
      nameZh: '人工智能',
      descriptionZh: '',
      slug: 'ai',
    });
    assert.equal(payload.description, '');
    assert.equal(payload.descriptionZh, '');
    assert.equal(payload.nameZh, '人工智能');
    const edit = tagsPage.toEditPayload({
      ...tagsPage.emptyForm,
      name: 'AI',
      description: '',
      nameZh: '',
      descriptionZh: '',
      slug: 'ai',
    });
    assert.equal('slug' in edit, false);
    assert.equal(edit.nameZh, '');
    assertJsonKeepsEmptyStrings(edit as Record<string, unknown>);
  });
});

type ToolTr = {
  locale: string;
  name: string;
  tagline: string | null;
  introduction: string | null;
};

async function toolTranslations(toolId: string): Promise<ToolTr[]> {
  return db()
    .select({
      locale: directoryToolTranslation.locale,
      name: directoryToolTranslation.name,
      tagline: directoryToolTranslation.tagline,
      introduction: directoryToolTranslation.introduction,
    })
    .from(directoryToolTranslation)
    .where(eq(directoryToolTranslation.toolId, toolId));
}

type NamedTr = {
  locale: string;
  name: string;
  description: string | null;
};

async function categoryTranslations(categoryId: string): Promise<NamedTr[]> {
  return db()
    .select({
      locale: directoryCategoryTranslation.locale,
      name: directoryCategoryTranslation.name,
      description: directoryCategoryTranslation.description,
    })
    .from(directoryCategoryTranslation)
    .where(eq(directoryCategoryTranslation.categoryId, categoryId));
}

async function tagTranslations(tagId: string): Promise<NamedTr[]> {
  return db()
    .select({
      locale: directoryTagTranslation.locale,
      name: directoryTagTranslation.name,
      description: directoryTagTranslation.description,
    })
    .from(directoryTagTranslation)
    .where(eq(directoryTagTranslation.tagId, tagId));
}

async function collectionTranslations(
  collectionId: string
): Promise<NamedTr[]> {
  return db()
    .select({
      locale: directoryCollectionTranslation.locale,
      name: directoryCollectionTranslation.name,
      description: directoryCollectionTranslation.description,
    })
    .from(directoryCollectionTranslation)
    .where(eq(directoryCollectionTranslation.collectionId, collectionId));
}

function byLocale<T extends { locale: string }>(rows: T[]) {
  const map = new Map<string, T>();
  for (const r of rows) map.set(r.locale, r);
  return {
    en: map.get('en'),
    zh: map.get('zh'),
  };
}

describe('server admin create/edit EN+ZH', () => {
  test('tools: create EN+ZH, update both, clear EN optionals, clear ZH name deletes zh', async () => {
    const created = await admin.createDirectoryToolAdmin({
      slug: 'tool-i18n-1',
      name: 'Tool EN',
      tagline: 'EN tagline',
      introduction: 'EN intro',
      nameZh: '工具中文',
      taglineZh: '中文标语',
      introductionZh: '中文介绍',
      status: 'published',
      source: 'editorial',
    });

    let rows = byLocale(await toolTranslations(created.id));
    assert.equal(rows.en?.name, 'Tool EN');
    assert.equal(rows.en?.tagline, 'EN tagline');
    assert.equal(rows.en?.introduction, 'EN intro');
    assert.equal(rows.zh?.name, '工具中文');
    assert.equal(rows.zh?.tagline, '中文标语');
    assert.equal(rows.zh?.introduction, '中文介绍');

    // Edit both locales (form toEditPayload shape: empty strings for clears later)
    await admin.updateDirectoryToolAdmin(created.id, {
      name: 'Tool EN2',
      tagline: 'EN tagline 2',
      introduction: 'EN intro 2',
      nameZh: '工具中文2',
      taglineZh: '中文标语2',
      introductionZh: '中文介绍2',
    });
    rows = byLocale(await toolTranslations(created.id));
    assert.equal(rows.en?.name, 'Tool EN2');
    assert.equal(rows.zh?.name, '工具中文2');
    assert.equal(rows.zh?.tagline, '中文标语2');

    // Clear EN optional fields with ''
    await admin.updateDirectoryToolAdmin(created.id, {
      name: 'Tool EN2',
      tagline: '',
      introduction: '',
      nameZh: '工具中文2',
      taglineZh: '中文标语2',
      introductionZh: '中文介绍2',
    });
    rows = byLocale(await toolTranslations(created.id));
    assert.equal(rows.en?.tagline, null);
    assert.equal(rows.en?.introduction, null);
    assert.equal(rows.zh?.tagline, '中文标语2');

    // Clear ZH name → delete zh row
    await admin.updateDirectoryToolAdmin(created.id, {
      name: 'Tool EN2',
      tagline: '',
      introduction: '',
      nameZh: '',
      taglineZh: '',
      introductionZh: '',
    });
    const afterClearZh = await toolTranslations(created.id);
    assert.equal(afterClearZh.length, 1);
    assert.equal(afterClearZh[0]?.locale, 'en');
    assert.equal(afterClearZh[0]?.name, 'Tool EN2');
  });

  test('categories: create EN+ZH, update, clear description, clear ZH name deletes zh', async () => {
    const created = await admin.createDirectoryCategoryAdmin({
      slug: 'cat-i18n-1',
      name: 'Cat EN',
      description: 'EN desc',
      nameZh: '分类中文',
      descriptionZh: '中文描述',
      status: 'published',
    });
    let rows = byLocale(await categoryTranslations(created.id));
    assert.equal(rows.en?.name, 'Cat EN');
    assert.equal(rows.en?.description, 'EN desc');
    assert.equal(rows.zh?.name, '分类中文');
    assert.equal(rows.zh?.description, '中文描述');

    await admin.updateDirectoryCategoryAdmin(created.id, {
      name: 'Cat EN2',
      description: '',
      nameZh: '分类中文2',
      descriptionZh: '',
    });
    rows = byLocale(await categoryTranslations(created.id));
    assert.equal(rows.en?.name, 'Cat EN2');
    assert.equal(rows.en?.description, null);
    assert.equal(rows.zh?.name, '分类中文2');
    assert.equal(rows.zh?.description, null);

    await admin.updateDirectoryCategoryAdmin(created.id, {
      name: 'Cat EN2',
      description: '',
      nameZh: '',
      descriptionZh: '',
    });
    const after = await categoryTranslations(created.id);
    assert.equal(after.length, 1);
    assert.equal(after[0]?.locale, 'en');
  });

  test('tags: create EN+ZH, update, clear ZH name deletes zh', async () => {
    const created = await admin.createDirectoryTagAdmin({
      slug: 'tag-i18n-1',
      name: 'Tag EN',
      description: 'EN',
      nameZh: '标签中文',
      descriptionZh: '中文',
    });
    let rows = byLocale(await tagTranslations(created.id));
    assert.equal(rows.en?.name, 'Tag EN');
    assert.equal(rows.zh?.name, '标签中文');

    await admin.updateDirectoryTagAdmin(created.id, {
      name: 'Tag EN2',
      description: '',
      nameZh: '标签中文2',
      descriptionZh: '',
    });
    rows = byLocale(await tagTranslations(created.id));
    assert.equal(rows.en?.description, null);
    assert.equal(rows.zh?.name, '标签中文2');
    assert.equal(rows.zh?.description, null);

    await admin.updateDirectoryTagAdmin(created.id, {
      name: 'Tag EN2',
      description: '',
      nameZh: '',
      descriptionZh: '',
    });
    const after = await tagTranslations(created.id);
    assert.equal(after.length, 1);
    assert.equal(after[0]?.locale, 'en');
  });

  test('collections: create EN+ZH, update, clear ZH name deletes zh', async () => {
    const created = await admin.createDirectoryCollectionAdmin({
      slug: 'col-i18n-1',
      name: 'Col EN',
      description: 'EN desc',
      nameZh: '合集中文',
      descriptionZh: '中文描述',
      status: 'published',
    });
    let rows = byLocale(await collectionTranslations(created.id));
    assert.equal(rows.en?.name, 'Col EN');
    assert.equal(rows.zh?.name, '合集中文');
    assert.equal(rows.zh?.description, '中文描述');

    await admin.updateDirectoryCollectionAdmin(created.id, {
      name: 'Col EN2',
      description: '',
      nameZh: '合集中文2',
      descriptionZh: '中文描述2',
    });
    rows = byLocale(await collectionTranslations(created.id));
    assert.equal(rows.en?.description, null);
    assert.equal(rows.zh?.name, '合集中文2');
    assert.equal(rows.zh?.description, '中文描述2');

    await admin.updateDirectoryCollectionAdmin(created.id, {
      name: 'Col EN2',
      description: '',
      nameZh: '',
      descriptionZh: '',
    });
    const after = await collectionTranslations(created.id);
    assert.equal(after.length, 1);
    assert.equal(after[0]?.locale, 'en');
  });

  test('create without nameZh does not insert zh row (tools/categories)', async () => {
    const tool = await admin.createDirectoryToolAdmin({
      slug: 'tool-en-only',
      name: 'EN only',
      tagline: 't',
      nameZh: '',
      taglineZh: 'should-not-save',
      introductionZh: 'should-not-save',
    });
    const toolRows = await toolTranslations(tool.id);
    assert.equal(toolRows.length, 1);
    assert.equal(toolRows[0]?.locale, 'en');

    const cat = await admin.createDirectoryCategoryAdmin({
      slug: 'cat-en-only',
      name: 'EN only',
      description: 'd',
      nameZh: '   ',
      descriptionZh: 'orphan',
    });
    const catRows = await categoryTranslations(cat.id);
    assert.equal(catRows.length, 1);
    assert.equal(catRows[0]?.locale, 'en');
  });
});
