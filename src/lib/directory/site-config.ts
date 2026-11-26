import type { FAQItem } from './types';

export const SITE_CONFIG = {
  name: 'ShipAny Dir',
  logo: '/imgs/brand/ai-dir-logo-orange.png',
};

export const FAQ_ITEMS: FAQItem[] = [
  {
    questionKey: 'directory.faq.q1',
    answerKey: 'directory.faq.a1',
  },
  {
    questionKey: 'directory.faq.q2',
    answerKey: 'directory.faq.a2',
  },
  {
    questionKey: 'directory.faq.q3',
    answerKey: 'directory.faq.a3',
  },
  {
    questionKey: 'directory.faq.q4',
    answerKey: 'directory.faq.a4',
  },
  {
    questionKey: 'directory.faq.q5',
    answerKey: 'directory.faq.a5',
  },
];

export const FOOTER_NAV = {
  directory: [
    { labelKey: 'directory.nav.tools', href: '/tools' },
    { labelKey: 'directory.nav.categories', href: '/categories' },
    { labelKey: 'directory.nav.collections', href: '/collections' },
    { labelKey: 'directory.nav.tags', href: '/tags' },
    { labelKey: 'directory.nav.feed', href: '/feed' },
  ],
  resources: [
    { labelKey: 'directory.nav.blog', href: '/blog' },
    { labelKey: 'directory.nav.submit', href: '/submit' },
    { labelKey: 'directory.nav.for_makers', href: '/advertise' },
  ],
  legal: [
    { labelKey: 'directory.nav.privacy_policy', href: '/privacy-policy' },
    { labelKey: 'directory.nav.terms_of_service', href: '/terms-of-service' },
  ],
};
