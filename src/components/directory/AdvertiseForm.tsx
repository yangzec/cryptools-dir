import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

import { createSponsorAdFn } from '@/modules/directory/server';
import { SPONSOR_TIERS, tr } from '@/lib/directory-data';
import {
  clearSponsorRebookDraft,
  takeSponsorRebookDraft,
} from '@/lib/directory/sponsor-rebook-draft';
import type { SponsorTier } from '@/lib/directory/submit-sponsor-config';
import { m } from '@/paraglide/messages.js';
import { useDirectoryCheckout } from '@/hooks/use-directory-checkout';
import {
  AdvertiseFormFaq,
  AdvertiseFormFields,
  AdvertiseFormPreview,
  AdvertiseFormTiers,
} from '@/components/directory/AdvertiseFormParts';
import { PaymentProviderModal } from '@/components/payment-provider-modal';

function mapSponsorError(code?: string) {
  if (code === 'sold_out') return m['dir.sponsor.error_sold_out']();
  if (code === 'pending_expired')
    return m['dir.sponsor.error_pending_expired']();
  if (code === 'pending_checkout')
    return m['dir.sponsor.error_pending_checkout']();
  if (code === 'tier_already_held')
    return m['dir.sponsor.error_tier_already_held']();
  if (code === 'Missing required fields' || code === 'missing_fields') {
    return m['dir.sponsor.error_missing_fields']();
  }
  if (code === 'Invalid URL' || code === 'invalid_url') {
    return m['dir.sponsor.error_invalid_url']();
  }
  if (code === 'common.checkout_failed') {
    return m['common.checkout_failed']();
  }
  const localized = code ? (m as any)[code] : null;
  if (typeof localized === 'function') return localized();
  return m['dir.sponsor.error_failed']();
}

type Inventory = Record<
  'silver' | 'gold' | 'platinum',
  { spots: number; left: number }
> | null;

export function AdvertiseForm({
  inventory,
  rebook = false,
}: {
  inventory?: Inventory;
  /** Only true when opened via settings/ads rebook (?rebook=1). */
  rebook?: boolean;
}) {
  const navigate = useNavigate();
  const pendingAdId = useRef<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<
    'silver' | 'gold' | 'platinum'
  >('gold');
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [url, setUrl] = useState('');
  const [iconUrl, setIconUrl] = useState('');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Prefill only for rebook; wipe any stale draft on a normal visit.
  useEffect(() => {
    if (!rebook) {
      clearSponsorRebookDraft();
      return;
    }
    const draft = takeSponsorRebookDraft();
    if (!draft) return;
    setName(draft.name);
    setTagline(draft.tagline);
    setUrl(draft.url);
    setIconUrl(draft.iconUrl || '');
    setSelectedTier(draft.tier);
    // Drop ?rebook=1 so refresh / share does not keep the rebook gate.
    navigate({
      to: '/advertise',
      search: {},
      hash: 'sponsors',
      replace: true,
    } as any);
  }, [rebook, navigate]);

  const tiers: SponsorTier[] = SPONSOR_TIERS.map((t) => ({
    ...t,
    spots: inventory?.[t.tier]?.spots ?? t.spots,
    // Hide fake scarcity when inventory failed to load: treat as available.
    left: inventory?.[t.tier]?.left ?? t.spots,
  }));

  const tierObj = tiers.find((t) => t.tier === selectedTier) || tiers[1];

  const checkout = useDirectoryCheckout({
    kind: 'ad',
    resolveId: async () => {
      if (pendingAdId.current) return pendingAdId.current;
      throw new Error('Missing ad id');
    },
    onError: (err) => toast.error(mapSponsorError(err.message)),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await createSponsorAdFn({
        data: {
          name,
          tagline,
          url,
          iconUrl: iconUrl || undefined,
          tier: selectedTier,
        },
      });
      if (!result.ok) {
        if (result.error === 'unauthorized') {
          navigate({
            to: '/sign-in',
            search: { callbackUrl: '/advertise' } as any,
          });
          return;
        }
        // Business errors: toast only — user stays on the form (no forced jump).
        toast.error(mapSponsorError(result.error));
        return;
      }
      pendingAdId.current = result.id;
      clearSponsorRebookDraft();
      checkout.pay();
    } catch (err: any) {
      toast.error(mapSponsorError(err?.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <CheckCircle2 className="size-10 text-emerald-500" />
        <h2 className="text-lg font-semibold">
          {m['directory.ad_success_title']()}
        </h2>
        <p className="text-muted-foreground max-w-md text-sm">
          {m['directory.ad_success_desc']({
            name: name || 'your brand',
            tier: tr(tierObj.nameKey),
          })}
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Link
            to={'/settings/ads' as any}
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-medium transition"
          >
            {m['directory.ad_manage_btn']()}
          </Link>
          <button
            type="button"
            onClick={() => {
              clearSponsorRebookDraft();
              setIsSubmitted(false);
              setName('');
              setTagline('');
              setUrl('');
              setIconUrl('');
            }}
            className="border-border bg-card hover:bg-muted inline-flex h-9 cursor-pointer items-center justify-center rounded-full border px-4 text-sm font-medium transition"
          >
            {m['directory.submit_another']()}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <form onSubmit={handleSubmit}>
        {/* Ad Details & Preview Split Section */}
        <section className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <AdvertiseFormFields
            name={name}
            setName={setName}
            tagline={tagline}
            setTagline={setTagline}
            url={url}
            setUrl={setUrl}
            iconUrl={iconUrl}
            setIconUrl={setIconUrl}
          />
          <AdvertiseFormPreview
            name={name}
            tagline={tagline}
            iconUrl={iconUrl}
            selectedTier={selectedTier}
          />
        </section>

        <AdvertiseFormTiers
          tiers={tiers}
          selectedTier={selectedTier}
          setSelectedTier={setSelectedTier}
        />

        {/* Submit / Continue Button */}
        <div className="mt-8">
          <button
            type="submit"
            disabled={isSubmitting || checkout.pending || tierObj.left <= 0}
            className="bg-primary text-primary-foreground hover:bg-primary/80 inline-flex h-9 w-full shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-transparent bg-clip-padding px-6 text-sm font-medium whitespace-nowrap transition-all outline-none select-none disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
          >
            {isSubmitting || checkout.pending
              ? m['common.pricing.processing']()
              : tierObj.left <= 0
                ? m['dir.sponsor.sold_out']()
                : m['dir.sponsor.continue_payment']({
                    price: `${tierObj.price}${m['dir.sponsor.per_month']()}`,
                  })}
          </button>
        </div>
      </form>

      <AdvertiseFormFaq
        openFaqIndex={openFaqIndex}
        setOpenFaqIndex={setOpenFaqIndex}
      />
      <PaymentProviderModal {...checkout.pickerProps} />
    </>
  );
}
