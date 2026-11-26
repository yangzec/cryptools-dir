import { createFileRoute } from '@tanstack/react-router';

import { m } from '@/paraglide/messages.js';
import { getLocale } from '@/paraglide/runtime.js';
import { AffiliatesLanding } from '@/blocks/affiliates-landing';
import { Footer } from '@/blocks/footer';
import { Header } from '@/blocks/header';

// Public affiliate program page. Like /guest-post, it stays routable while
// the program is off and shows a "not open" note instead of the pitch.
export const Route = createFileRoute('/affiliates')({
  loader: () => {
    const locale = getLocale();
    return {
      title: m['landing.affiliates.meta_title']({}, { locale }),
      description: m['landing.affiliates.meta_description']({}, { locale }),
    };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: loaderData.title },
          { name: 'description', content: loaderData.description },
        ]
      : [],
  }),
  component: AffiliatesPage,
});

function AffiliatesPage() {
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <AffiliatesLanding />
      </main>
      <Footer />
    </div>
  );
}
