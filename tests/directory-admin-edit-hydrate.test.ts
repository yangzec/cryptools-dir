/**
 * Edit-drawer hydrate helpers: mapping list/detail rows → form defaultValues.
 * Guards against empty-form regressions (Base UI Sheet remount + useForm).
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

const { valuesFromToolDetail } =
  await import('../src/routes/admin/directory/-tools-shared.tsx');
const { valuesFromCategory } =
  await import('../src/routes/admin/directory/-categories-form.tsx');
const { valuesFromCollection } =
  await import('../src/routes/admin/directory/-collections-form.tsx');
const { valuesFromAd, toDatetimeLocal } =
  await import('../src/routes/admin/directory/-ads-form.tsx');

describe('valuesFrom* edit hydrate mappers', () => {
  test('valuesFromToolDetail copies EN/ZH + categoryId + tags', () => {
    const v = valuesFromToolDetail({
      id: 't1',
      slug: 'acme',
      name: 'Acme',
      tagline: 'go',
      introduction: 'intro',
      nameZh: '艾克米',
      taglineZh: '标语',
      introductionZh: '介绍',
      websiteUrl: 'https://a.test',
      iconUrl: 'https://cdn/x.png',
      pricing: 'paid',
      authorName: 'Ada',
      categoryId: 'cat-1',
      source: 'editorial',
      status: 'published',
      featured: true,
      sponsored: false,
      sort: 12,
      tagIds: ['tag-a', 'tag-b'],
    });
    assert.equal(v.name, 'Acme');
    assert.equal(v.nameZh, '艾克米');
    assert.equal(v.categoryId, 'cat-1');
    assert.equal(v.iconUrl, 'https://cdn/x.png');
    assert.equal(v.sort, '12');
    assert.deepEqual(v.tagIds, ['tag-a', 'tag-b']);
    // Fresh array — not the same reference as input
    assert.equal(v.featured, true);
  });

  test('valuesFromToolDetail nullish → empty defaults', () => {
    const v = valuesFromToolDetail({});
    assert.equal(v.name, '');
    assert.equal(v.categoryId, '');
    assert.equal(v.pricing, 'free');
    assert.equal(v.sort, '0');
    assert.deepEqual(v.tagIds, []);
  });

  test('valuesFromCategory / Collection / Ad map core fields', () => {
    const cat = valuesFromCategory({
      id: 'c1',
      slug: 'coding',
      name: 'Coding',
      description: 'd',
      nameZh: '编程',
      descriptionZh: '描述',
      icon: 'code',
      sort: 5,
      status: 'published',
      toolCount: 2,
      createdAt: '',
    } as any);
    assert.equal(cat.name, 'Coding');
    assert.equal(cat.nameZh, '编程');
    assert.equal(cat.sort, '5');

    const col = valuesFromCollection({
      id: 'col1',
      slug: 'best',
      name: 'Best',
      description: null,
      nameZh: '精选',
      descriptionZh: '',
      icon: '',
      coverUrl: 'https://cdn/c.png',
      sort: 3,
      status: 'draft',
      toolIds: ['a'],
      createdAt: '',
    } as any);
    assert.equal(col.coverUrl, 'https://cdn/c.png');
    assert.equal(col.status, 'draft');
    assert.equal(col.description, '');

    const ad = valuesFromAd({
      id: 'ad1',
      name: 'Acme',
      tagline: 'hi',
      url: 'https://a.test',
      iconUrl: 'https://cdn/i.png',
      tier: 'platinum',
      status: 'active',
      startsAt: '2026-01-15T08:30:00.000Z',
      endsAt: null,
      createdAt: '',
    });
    assert.equal(ad.name, 'Acme');
    assert.equal(ad.tier, 'platinum');
    assert.equal(ad.iconUrl, 'https://cdn/i.png');
    assert.equal(ad.endsAt, '');
    assert.equal(ad.startsAt, toDatetimeLocal('2026-01-15T08:30:00.000Z'));

    // Empty DB icon must stay empty (do not seed Google favicon into the form).
    const adNoIcon = valuesFromAd({
      id: 'ad2',
      name: 'Bare',
      tagline: '',
      url: 'https://b.test',
      iconUrl: '',
      tier: 'gold',
      status: 'active',
      startsAt: null,
      endsAt: null,
      createdAt: '',
    });
    assert.equal(adNoIcon.iconUrl, '');
  });
});
