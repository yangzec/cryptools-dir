import { envConfigs } from '@/config';

/** Outbound referral UTM so makers can attribute directory traffic. */
export function withDirectoryUtm(url: string) {
  try {
    const u = new URL(url);
    if (!u.searchParams.has('utm_source')) {
      u.searchParams.set('utm_source', 'shipany-dir');
      u.searchParams.set('utm_medium', 'referral');
      u.searchParams.set('utm_campaign', 'directory');
    }
    return u.toString();
  } catch {
    return url;
  }
}

function abs(path: string) {
  const base = (envConfigs.app_url || '').replace(/\/$/, '');
  if (!path) return base || '/';
  if (path.startsWith('http')) return path;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export function toolJsonLd(tool: {
  name: string;
  slug: string;
  tagline?: string | null;
  websiteUrl?: string | null;
  iconUrl?: string | null;
  screenshots?: string[];
  categoryName?: string | null;
  pricing?: string;
  faqs?: Array<{ question: string; answer: string }>;
}) {
  const pageUrl = abs(`/tools/${tool.slug}`);
  const graph: Record<string, unknown>[] = [
    {
      '@type': 'SoftwareApplication',
      '@id': `${pageUrl}#app`,
      name: tool.name,
      description: tool.tagline || undefined,
      url: pageUrl,
      applicationCategory: tool.categoryName || 'BusinessApplication',
      operatingSystem: 'Web',
      image: tool.screenshots?.[0] || tool.iconUrl || undefined,
      offers: {
        '@type': 'Offer',
        price: tool.pricing === 'free' ? '0' : undefined,
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        url: tool.websiteUrl || pageUrl,
      },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: abs('/'),
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Tools',
          item: abs('/tools'),
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: tool.name,
          item: pageUrl,
        },
      ],
    },
  ];

  if (tool.faqs && tool.faqs.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: tool.faqs.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    });
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}

export function listingJsonLd(opts: {
  name: string;
  description?: string | null;
  path: string;
  items: Array<{ name: string; slug: string; tagline?: string | null }>;
}) {
  const pageUrl = abs(opts.path);
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: opts.name,
    description: opts.description || undefined,
    url: pageUrl,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: opts.items.length,
      itemListElement: opts.items.map((t, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: abs(`/tools/${t.slug}`),
        name: t.name,
        description: t.tagline || undefined,
      })),
    },
  };
}
