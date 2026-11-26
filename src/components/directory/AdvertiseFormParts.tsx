import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowUpRight, Check, ChevronDown } from 'lucide-react';

import { useSession } from '@/core/auth/client';
import {
  ADVERTISE_FAQ_ITEMS,
  ADVERTISE_STEP_KEYS,
  SPONSOR_TIERS,
  tr,
} from '@/lib/directory-data';
import { SPONSOR_TIER_STYLES } from '@/lib/directory/sponsor-tier-styles';
import { m } from '@/paraglide/messages.js';
import {
  ImageUploader,
  type ImageUploaderValue,
} from '@/components/image-uploader';

export const TIER_STYLES = SPONSOR_TIER_STYLES;

export function AdvertiseFormFields({
  name,
  setName,
  tagline,
  setTagline,
  url,
  setUrl,
  iconUrl,
  setIconUrl,
}: {
  name: string;
  setName: (v: string) => void;
  tagline: string;
  setTagline: (v: string) => void;
  url: string;
  setUrl: (v: string) => void;
  iconUrl: string;
  setIconUrl: (v: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const { data: session, isPending } = useSession();
  useEffect(() => setMounted(true), []);
  // Avoid SSR/hydration mismatch, and do not flash "Sign in" while session loads.
  const authReady = mounted && !isPending;
  const user = authReady ? session?.user : undefined;

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">
        {m['dir.sponsor.section_ad']()}
      </h2>
      <div className="space-y-4">
        {/* Product name */}
        <div className="space-y-2">
          <label htmlFor="ad-name" className="text-sm leading-none font-medium">
            {m['dir.sponsor.field_name']()}
          </label>
          <input
            id="ad-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={m['dir.sponsor.field_name_ph']()}
            className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full min-w-0 rounded-lg border bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:ring-3"
          />
        </div>

        {/* Tagline */}
        <div className="space-y-2">
          <label
            htmlFor="ad-tagline"
            className="text-sm leading-none font-medium"
          >
            {m['dir.sponsor.field_tagline']()}
          </label>
          <input
            id="ad-tagline"
            type="text"
            required
            maxLength={120}
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder={m['dir.sponsor.field_tagline_placeholder']()}
            className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full min-w-0 rounded-lg border bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:ring-3"
          />
        </div>

        {/* Link */}
        <div className="space-y-2">
          <label htmlFor="ad-url" className="text-sm leading-none font-medium">
            {m['dir.sponsor.field_url']()}
          </label>
          <input
            id="ad-url"
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={m['dir.sponsor.field_url_ph']()}
            className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full min-w-0 rounded-lg border bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:ring-3"
          />
        </div>

        {/* Logo: upload when signed in; otherwise prompt to sign in */}
        <div className="space-y-2">
          <label className="text-sm leading-none font-medium">
            {m['dir.sponsor.field_icon']()}
          </label>
          {!authReady ? (
            <div
              className="bg-muted/60 h-24 animate-pulse rounded-lg"
              aria-hidden
            />
          ) : user ? (
            <ImageUploader
              maxSizeMB={2}
              defaultPreviews={iconUrl ? [iconUrl] : []}
              onChange={(items: ImageUploaderValue[]) => {
                const uploaded = items.find(
                  (item) => item.status === 'uploaded' && item.url
                );
                if (uploaded?.url) {
                  setIconUrl(uploaded.url);
                  return;
                }
                const busy = items.some((item) => item.status === 'uploading');
                if (!busy && items.length === 0) setIconUrl('');
              }}
            />
          ) : (
            <p className="text-muted-foreground text-sm">
              <Link
                to={'/sign-in' as any}
                search={{ callbackUrl: '/advertise' } as any}
                className="text-primary cursor-pointer hover:underline"
              >
                {m['dir.sponsor.sign_in_upload']()}
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function AdvertiseFormPreview({
  name,
  tagline,
  iconUrl,
  selectedTier,
}: {
  name: string;
  tagline: string;
  iconUrl: string;
  selectedTier: 'silver' | 'gold' | 'platinum';
}) {
  const tierObj =
    SPONSOR_TIERS.find((t) => t.tier === selectedTier) || SPONSOR_TIERS[1];
  const currentTierStyle =
    SPONSOR_TIER_STYLES[selectedTier] || SPONSOR_TIER_STYLES.gold;
  const CurrentTierIcon = currentTierStyle.icon;

  return (
    <div className="space-y-6">
      {/* Live Preview Card */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">
          {m['dir.sponsor.section_preview']()}
        </h2>
        <div
          className={`group relative flex items-start gap-3 rounded-xl border p-4 transition ${currentTierStyle.card}`}
        >
          <span
            title={`${tr(tierObj.nameKey)} sponsor`}
            className="text-muted-foreground absolute top-3 right-3 flex items-center gap-1 text-[10px] font-semibold tracking-[0.12em] uppercase"
          >
            {m['dir.sponsor.tag_sponsor']()}
            <CurrentTierIcon
              className={`size-3.5 ${currentTierStyle.iconClass}`}
            />
          </span>

          <div
            className="border-border/60 bg-secondary/50 shrink-0 overflow-hidden rounded-lg border"
            style={{ width: 40, height: 40 }}
          >
            {iconUrl ? (
              <img
                src={iconUrl}
                alt={name}
                className="size-full object-cover"
              />
            ) : (
              <div className="from-primary/15 to-primary/5 text-primary grid size-full place-items-center bg-gradient-to-br">
                <span className="font-semibold" style={{ fontSize: 13.33 }}>
                  {name ? name.slice(0, 2).toUpperCase() : 'AA'}
                </span>
              </div>
            )}
          </div>

          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1 pr-16 text-[15px] leading-tight font-semibold">
              <span className="truncate">{name || 'Acme AI'}</span>
              <ArrowUpRight className="text-muted-foreground size-3.5 shrink-0 opacity-0 transition group-hover:opacity-100" />
            </span>
            <span className="text-muted-foreground mt-1 line-clamp-2 text-[13px] leading-5">
              {tagline || m['dir.sponsor.field_tagline_placeholder']()}
            </span>
          </span>
        </div>
      </div>

      {/* How it works */}
      <div className="border-border rounded-2xl border p-5">
        <h3 className="mb-3 text-sm font-semibold">
          {m['dir.sponsor.how_it_works']()}
        </h3>
        <ol className="space-y-2.5">
          {ADVERTISE_STEP_KEYS.map((sKey, idx) => (
            <li key={idx} className="flex items-start gap-2.5 text-sm">
              <span className="bg-primary/10 text-primary mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold">
                {idx + 1}
              </span>
              <span className="text-muted-foreground leading-relaxed">
                {tr(sKey)}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export function AdvertiseFormTiers({
  tiers = SPONSOR_TIERS,
  selectedTier,
  setSelectedTier,
}: {
  tiers?: typeof SPONSOR_TIERS;
  selectedTier: 'silver' | 'gold' | 'platinum';
  setSelectedTier: (tier: 'silver' | 'gold' | 'platinum') => void;
}) {
  return (
    <section className="mt-10">
      <h2 className="mb-4 text-lg font-semibold">
        {m['dir.sponsor.choose_tier']()}
      </h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {tiers.map((tier) => {
          const isSelected = selectedTier === tier.tier;
          const isSoldOut = tier.left <= 0;
          const TierIcon = TIER_STYLES[tier.tier].icon;

          return (
            <button
              key={tier.tier}
              type="button"
              disabled={isSoldOut}
              aria-pressed={isSelected}
              onClick={() => setSelectedTier(tier.tier)}
              className={`relative flex cursor-pointer flex-col rounded-2xl border p-5 text-left transition ${
                isSelected
                  ? 'border-primary bg-primary/5 ring-primary/30 ring-2'
                  : 'border-border bg-card hover:border-primary/40'
              } ${isSoldOut ? 'hover:border-border cursor-not-allowed opacity-60' : ''}`}
            >
              {isSelected && !isSoldOut && (
                <span className="bg-primary text-primary-foreground absolute top-4 right-4 grid size-5 place-items-center rounded-full">
                  <Check className="size-3.5" />
                </span>
              )}
              <span className="flex items-center gap-2 pr-7 font-semibold">
                <TierIcon className="text-primary size-4" />
                <span>{tr(tier.nameKey)}</span>
              </span>
              <span className="mt-3 text-2xl font-semibold tracking-tight">
                {tier.price}
                <span className="text-muted-foreground text-sm font-normal">
                  {m['dir.sponsor.per_month']()}
                </span>
              </span>
              <ul className="text-muted-foreground mt-3 flex-1 space-y-1.5 text-sm">
                {tier.featureKeys.map((fKey, i) => (
                  <li key={i} className="flex gap-2">
                    <Check className="text-foreground mt-0.5 size-3.5 shrink-0" />
                    <span>{tr(fKey)}</span>
                  </li>
                ))}
              </ul>
              <span
                className={`mt-4 text-xs font-medium ${
                  isSoldOut ? 'text-destructive' : 'text-primary'
                }`}
              >
                {isSoldOut
                  ? m['dir.sponsor.sold_out']()
                  : m['dir.sponsor.spots_left']({
                      left: tier.left.toString(),
                      total: tier.spots.toString(),
                    })}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-muted-foreground mt-3 text-xs">
        {m['dir.sponsor.billing_note']()}
      </p>
    </section>
  );
}

export function AdvertiseFormFaq({
  openFaqIndex,
  setOpenFaqIndex,
}: {
  openFaqIndex: number | null;
  setOpenFaqIndex: (index: number | null) => void;
}) {
  return (
    <section className="mt-16 pb-4">
      <h2 className="mb-4 text-lg font-semibold">
        {m['dir.sponsor.faq_title']()}
      </h2>
      <div className="border-border flex flex-col border-b">
        {ADVERTISE_FAQ_ITEMS.map((faq, i) => {
          const isOpen = openFaqIndex === i;
          return (
            <div key={i} className="border-border border-t">
              <h3 className="flex">
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="group/accordion-trigger relative flex flex-1 cursor-pointer items-start justify-between rounded-lg border border-transparent py-4 text-left text-[15px] font-medium transition-all outline-none hover:no-underline"
                >
                  <span>{tr(faq.questionKey)}</span>
                  <ChevronDown
                    className={`text-muted-foreground ml-auto size-4 shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              </h3>
              {isOpen && (
                <div className="text-muted-foreground animate-in fade-in-50 pb-4 text-sm leading-relaxed duration-150">
                  {tr(faq.answerKey)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
