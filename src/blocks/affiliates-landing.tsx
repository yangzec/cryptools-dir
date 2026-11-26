import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Gift, Link2, Share2, TicketPercent, Wallet } from 'lucide-react';

import { useSession } from '@/core/auth/client';
import { Link } from '@/core/i18n/navigation';
import { envConfigs } from '@/config';
import type { AffiliateRewardRule } from '@/config/affiliates';
import { apiGet } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { usePublicConfig } from '@/hooks/use-public-config';
import {
  rewardHeadline,
  rewardRenewalsAnswer,
  rewardScopeNote,
  rewardScopeText,
} from '@/blocks/affiliate-reward-rule';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { buttonVariants } from '@/components/ui/button';

const DASHBOARD_PATH = '/settings/affiliates';

type LeaderboardItem = { invites: number; name: string; avatar: string | null };
type AffiliateStatus = {
  enabled: boolean;
  isMember: boolean;
  status: string | null;
  /** What affiliates earn; null while the program is off. */
  rule: AffiliateRewardRule | null;
};

// /affiliates: the public pitch for the affiliate program.
export function AffiliatesLanding() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { data: session } = useSession();
  const { data: configs, isPending: configPending } = usePublicConfig();
  const enabled = configs?.affiliates_enabled === 'true';

  const statusQuery = useQuery({
    queryKey: ['affiliate-status', session?.user?.id ?? null],
    queryFn: () => apiGet<AffiliateStatus>('/api/affiliates/status'),
    enabled,
  });
  const leaderboardQuery = useQuery({
    queryKey: ['affiliate-leaderboard'],
    queryFn: () =>
      apiGet<{ items: LeaderboardItem[] }>('/api/affiliates/leaderboard'),
    enabled,
  });

  const appName = envConfigs.app_name;
  const status = statusQuery.data?.status ?? null;
  const isMember = statusQuery.data?.isMember ?? false;

  const isAuthed = mounted && !!session?.user;
  // Signed out → sign in first, then land on the dashboard to apply.
  const ctaHref = isAuthed
    ? DASHBOARD_PATH
    : `/sign-in?callbackUrl=${encodeURIComponent(DASHBOARD_PATH)}`;
  const ctaLabel = !isAuthed
    ? m['landing.affiliates.cta_sign_in']()
    : isMember
      ? m['landing.affiliates.cta_member']()
      : status === 'pending'
        ? m['landing.affiliates.cta_pending']()
        : m['landing.affiliates.cta_apply']();

  const steps = [
    {
      icon: Gift,
      title: m['landing.affiliates.step_apply_title'](),
      text: m['landing.affiliates.step_apply_desc'](),
    },
    {
      icon: Share2,
      title: m['landing.affiliates.step_share_title'](),
      text: m['landing.affiliates.step_share_desc'](),
    },
    {
      icon: TicketPercent,
      title: m['landing.affiliates.step_earn_title'](),
      text: m['landing.affiliates.step_earn_desc'](),
    },
    {
      icon: Wallet,
      title: m['landing.affiliates.step_withdraw_title'](),
      text: m['landing.affiliates.step_withdraw_desc'](),
    },
  ];

  const rule = statusQuery.data?.rule ?? null;
  const faqs = [
    {
      q: m['landing.affiliates.faq_join_q'](),
      a: m['landing.affiliates.faq_join_a'](),
    },
    {
      q: m['landing.affiliates.faq_split_q'](),
      a: m['landing.affiliates.faq_split_a'](),
    },
    {
      q: m['landing.affiliates.faq_renewals_q'](),
      a: rewardRenewalsAnswer(rule),
    },
    {
      q: m['landing.affiliates.faq_refunds_q'](),
      a: m['landing.affiliates.faq_refunds_a'](),
    },
    {
      q: m['landing.affiliates.faq_withdraw_q'](),
      a: m['landing.affiliates.faq_withdraw_a'](),
    },
  ];

  // What an affiliate earns, from the admin's rule.
  const earnCards = rule
    ? [
        {
          label: m['landing.affiliates.earn_reward'](),
          value: rewardHeadline(rule),
          note: m['landing.affiliates.earn_reward_percent'](),
          extra: '',
        },
        {
          label: m['landing.affiliates.earn_scope'](),
          value: rewardScopeText(rule),
          note: rewardScopeNote(rule),
          extra: '',
        },
        {
          label: m['landing.affiliates.earn_hold'](),
          value:
            rule.holdDays > 0
              ? m['landing.affiliates.earn_hold_value']({ days: rule.holdDays })
              : m['landing.affiliates.earn_hold_now'](),
          note: m['landing.affiliates.earn_hold_note'](),
          extra: '',
        },
      ]
    : [];
  const leaders = leaderboardQuery.data?.items ?? [];

  const cta = (
    <Link
      href={ctaHref}
      className={cn(buttonVariants({ size: 'lg' }), 'h-10 gap-2 px-6')}
    >
      <Link2 className="size-4" />
      {ctaLabel}
    </Link>
  );

  return (
    <div>
      {/* Hero */}
      <section className="px-4 pt-20 pb-16 sm:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-serif text-4xl font-normal tracking-tight text-balance sm:text-5xl">
            {m['landing.affiliates.title']()}
          </h1>
          <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-balance">
            {m['landing.affiliates.subtitle']({ app: appName })}
          </p>
          {enabled && <div className="mt-8 flex justify-center">{cta}</div>}
        </div>
      </section>

      {!configPending && !enabled ? (
        <p className="text-muted-foreground px-4 pb-24 text-center">
          {m['landing.affiliates.closed']()}
        </p>
      ) : (
        <>
          {/* How it works */}
          <section className="border-border border-t px-4 py-20">
            <div className="mx-auto max-w-5xl">
              <h2 className="text-center font-serif text-3xl font-normal tracking-tight sm:text-4xl">
                {m['landing.affiliates.steps_title']()}
              </h2>
              <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {steps.map((s, i) => (
                  <li key={i} className="rounded-2xl border p-6">
                    <s.icon className="text-muted-foreground size-5" />
                    <p className="mt-4 font-medium">
                      {i + 1}. {s.title}
                    </p>
                    <p className="text-muted-foreground mt-2 text-sm">
                      {s.text}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* What you earn — from the admin's reward rule */}
          {earnCards.length > 0 && (
            <section className="border-border border-t px-4 py-20">
              <div className="mx-auto max-w-5xl">
                <div className="mx-auto max-w-2xl text-center">
                  <h2 className="font-serif text-3xl font-normal tracking-tight sm:text-4xl">
                    {m['landing.affiliates.earn_title']()}
                  </h2>
                  <p className="text-muted-foreground mt-4 text-balance">
                    {m['landing.affiliates.earn_desc']()}
                  </p>
                </div>
                <div
                  className={cn(
                    'mx-auto mt-12 grid gap-4',
                    earnCards.length >= 3
                      ? 'sm:grid-cols-3'
                      : 'max-w-3xl sm:grid-cols-2'
                  )}
                >
                  {earnCards.map((card, i) => (
                    <div
                      key={card.label}
                      className={cn(
                        'flex flex-col items-center rounded-2xl border px-6 py-8 text-center',
                        i === 0 && 'bg-card ring-foreground/10 shadow-md ring-1'
                      )}
                    >
                      <p className="text-sm font-medium">{card.label}</p>
                      <p
                        className={cn(
                          'mt-3 font-serif tracking-tight text-balance',
                          i === 0 ? 'text-5xl' : 'text-2xl sm:text-3xl'
                        )}
                      >
                        {card.value}
                      </p>
                      <p className="text-muted-foreground mt-2 text-sm">
                        {card.note}
                      </p>
                      {card.extra ? (
                        <p className="text-muted-foreground mt-1 text-xs">
                          {card.extra}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Leaderboard — hidden until someone has invited a buyer */}
          {leaders.length > 0 && (
            <section className="border-border border-t px-4 py-20">
              <div className="mx-auto max-w-3xl">
                <div className="text-center">
                  <h2 className="font-serif text-3xl font-normal tracking-tight sm:text-4xl">
                    {m['landing.affiliates.leaderboard_title']()}
                  </h2>
                  <p className="text-muted-foreground mt-4">
                    {m['landing.affiliates.leaderboard_desc']()}
                  </p>
                </div>
                <ol className="mt-10 divide-y rounded-2xl border">
                  {leaders.map((item, i) => (
                    <li
                      key={`${item.name}-${i}`}
                      className="flex items-center justify-between gap-4 px-5 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="text-muted-foreground w-6 shrink-0 text-center text-sm font-semibold">
                          {i + 1}
                        </span>
                        <Avatar>
                          {item.avatar && (
                            <AvatarImage src={item.avatar} alt={item.name} />
                          )}
                          <AvatarFallback>
                            {item.name.slice(0, 1).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate text-sm font-medium">
                          {item.name}
                        </span>
                      </div>
                      <span className="text-muted-foreground shrink-0 text-sm">
                        {m['landing.affiliates.leaderboard_count']({
                          count: item.invites,
                        })}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          )}

          {/* FAQ */}
          <section className="border-border border-t px-4 py-20">
            <div className="mx-auto max-w-3xl">
              <h2 className="text-center font-serif text-3xl font-normal tracking-tight sm:text-4xl">
                {m['landing.affiliates.faq_title']()}
              </h2>
              <Accordion className="mt-10 w-full">
                {faqs.map((f, i) => (
                  <AccordionItem key={i} value={String(i)}>
                    <AccordionTrigger className="cursor-pointer py-5 text-left text-base font-medium hover:no-underline">
                      {f.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-5 leading-relaxed">
                      {f.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </section>

          {/* CTA */}
          <section className="border-border border-t px-4 py-20 sm:py-24">
            <div className="bg-card mx-auto max-w-4xl rounded-3xl border p-10 text-center shadow-sm sm:p-14">
              <h2 className="font-serif text-3xl font-normal tracking-tight text-balance sm:text-4xl">
                {m['landing.affiliates.cta_title']()}
              </h2>
              <p className="text-muted-foreground mx-auto mt-4 mb-8 max-w-xl text-balance">
                {m['landing.affiliates.cta_desc']({ app: appName })}
              </p>
              <div className="flex justify-center">{cta}</div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
