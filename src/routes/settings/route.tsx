import { createFileRoute, Outlet } from '@tanstack/react-router';
import {
  Coins,
  CreditCard,
  Handshake,
  Home,
  Key,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  PenLine,
  Presentation,
  Receipt,
  User,
} from 'lucide-react';

import { m } from '@/paraglide/messages.js';
import { getLocale } from '@/paraglide/runtime.js';
import { useGuestPostInfo } from '@/hooks/use-guest-posts';
import { useUserFeatures } from '@/hooks/use-user-features';
import { SupportWidget } from '@/blocks/support-widget';
import { AppLayout } from '@/components/app-layout';
import type { NavItem } from '@/components/app-sidebar';
import { SiteBrand } from '@/components/site-brand';

export const Route = createFileRoute('/settings')({
  loader: () => ({ locale: getLocale() }),
  head: ({ loaderData }) => {
    const locale = loaderData?.locale ?? 'en';
    return {
      meta: [
        {
          title: m['directory.brand_name']({}, { locale: locale as any }),
        },
      ],
    };
  },
  component: SettingsLayout,
});

function SettingsLayout() {
  const activityGroup = m['settings.nav.group_activity']();
  const accountGroup = m['settings.nav.group_account']();
  const contentGroup = m['settings.nav.group_content']();
  // Optional pages an admin switches in Settings → Users → User Features.
  const features = useUserFeatures();
  const navItems: (NavItem & { show?: boolean })[] = [
    {
      href: '/settings',
      label: m['settings.nav.overview'](),
      icon: LayoutDashboard,
    },
    {
      href: '/settings/submissions',
      label: m['settings.nav.submissions'](),
      icon: Megaphone,
      group: activityGroup,
    },
    {
      href: '/settings/ads',
      label: m['settings.nav.ads'](),
      icon: Presentation,
      group: activityGroup,
    },
    {
      href: '/settings/profile',
      label: m['settings.nav.profile'](),
      icon: User,
      group: accountGroup,
    },
    {
      href: '/settings/credits',
      label: m['settings.nav.credits'](),
      icon: Coins,
      group: accountGroup,
      show: features.credits,
    },
    {
      href: '/settings/billing',
      label: m['settings.nav.billing'](),
      icon: CreditCard,
      group: accountGroup,
      show: features.billing,
    },
    {
      href: '/settings/payments',
      label: m['settings.nav.payments'](),
      icon: Receipt,
      group: accountGroup,
      show: features.payments,
    },
    {
      href: '/settings/apikeys',
      label: m['settings.nav.apikeys'](),
      icon: Key,
      group: accountGroup,
      show: features.apikeys,
    },
    {
      href: '/settings/affiliates',
      label: m['settings.nav.affiliates'](),
      icon: Handshake,
      group: accountGroup,
      show: features.affiliates,
    },
    {
      href: '/settings/tickets',
      label: m['settings.nav.tickets'](),
      icon: LifeBuoy,
      group: contentGroup,
      show: features.tickets,
    },
  ].filter((item) => item.show !== false);

  // Only when the site accepts guest posts.
  const guestPostInfo = useGuestPostInfo();
  if (guestPostInfo.data?.enabled) {
    navItems.push({
      href: '/settings/guest-posts',
      label: m['settings.nav.guest_posts'](),
      icon: PenLine,
      group: contentGroup,
    });
  }

  const footerNavItems = [
    { href: '/', label: m['common.systems.home'](), icon: Home, newTab: true },
  ];

  return (
    <AppLayout
      navItems={navItems}
      footerNavItems={footerNavItems}
      brand={
        <SiteBrand
          nameClassName="flex-1 truncate font-serif text-lg leading-normal py-0.5 italic group-data-[collapsible=icon]:hidden"
          nameReplaceClassName
        />
      }
      brandHref="/settings"
    >
      <Outlet />
      <SupportWidget />
    </AppLayout>
  );
}
