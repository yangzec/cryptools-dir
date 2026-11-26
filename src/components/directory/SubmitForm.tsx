import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

import { useSession } from '@/core/auth/client';
import {
  getDirectoryCategoriesFn,
  submitDirectoryToolFn,
} from '@/modules/directory/server';
import { SUBMIT_TIERS } from '@/lib/directory-data';
import { m } from '@/paraglide/messages.js';
import { getLocale } from '@/paraglide/runtime.js';
import { useDirectoryCheckout } from '@/hooks/use-directory-checkout';
import {
  SubmitFormFaq,
  SubmitFormFields,
  SubmitFormPreview,
  SubmitFormTiers,
} from '@/components/directory/SubmitFormParts';
import { PaymentProviderModal } from '@/components/payment-provider-modal';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

function mapSubmitError(code?: string) {
  if (code === 'Missing required fields' || code === 'missing_fields') {
    return m['dir.submit.error_missing_fields']();
  }
  if (code === 'Invalid website URL' || code === 'invalid_url') {
    return m['dir.submit.error_invalid_url']();
  }
  if (code === 'Invalid category' || code === 'invalid_category') {
    return m['dir.submit.error_invalid_category']();
  }
  if (code === 'common.checkout_failed') {
    return m['common.checkout_failed']();
  }
  const localized = code ? (m as any)[code] : null;
  if (typeof localized === 'function') return localized();
  return m['dir.submit.error_failed']();
}

export function SubmitForm() {
  // Keep SSR + first paint on the form; swap to sign-in only after session settles.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();
  const pendingToolId = useRef<string | null>(null);
  const [name, setName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [tagline, setTagline] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTier, setSelectedTier] = useState<string>('free');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [categories, setCategories] = useState<
    Array<{ id: string; name: string; slug?: string }>
  >([]);

  useEffect(() => {
    let cancelled = false;
    getDirectoryCategoriesFn({ data: { locale: getLocale() } })
      .then((rows) => {
        if (cancelled) return;
        setCategories(
          (rows || []).map((c: any) => ({
            id: c.id,
            name: c.name || c.slug,
            slug: c.slug,
          }))
        );
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const tierObj =
    SUBMIT_TIERS.find((t) => t.id === selectedTier) || SUBMIT_TIERS[0];

  const checkout = useDirectoryCheckout({
    kind: 'tool',
    resolveId: async () => {
      if (pendingToolId.current) return pendingToolId.current;
      throw new Error('Missing submission id');
    },
    onError: (err) => toast.error(mapSubmitError(err.message)),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId) {
      toast.error(m['dir.submit.error_invalid_category']());
      return;
    }
    setIsSubmitting(true);
    try {
      const plan = selectedTier === 'premium' ? 'premium' : 'free';
      const result = await submitDirectoryToolFn({
        data: {
          locale: getLocale(),
          name,
          websiteUrl,
          tagline,
          categoryId,
          description,
          plan,
        },
      });
      if (!result.ok) {
        if (result.error === 'unauthorized') {
          navigate({
            to: '/sign-in',
            search: { callbackUrl: '/submit' } as any,
          });
          return;
        }
        toast.error(mapSubmitError(result.error));
        return;
      }
      if (plan === 'premium' && result.status === 'pending_payment') {
        pendingToolId.current = result.id;
        checkout.pay();
        return;
      }
      setIsSubmitted(true);
    } catch (err: any) {
      toast.error(mapSubmitError(err?.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (mounted && !isPending && !session?.user) {
    return (
      <>
        <Card className="mx-auto max-w-2xl">
          <CardContent>
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-muted-foreground text-sm">
                {m['dir.submit.sign_in_required']()}
              </p>
              <Link
                to="/sign-in"
                search={{ callbackUrl: '/submit' } as any}
                className={buttonVariants({ size: 'default' })}
              >
                {m['common.sign.sign_in_title']()}
              </Link>
            </div>
          </CardContent>
        </Card>
        <SubmitFormFaq
          openFaqIndex={openFaqIndex}
          setOpenFaqIndex={setOpenFaqIndex}
        />
      </>
    );
  }

  if (isSubmitted) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <CheckCircle2 className="size-10 text-emerald-500" />
        <h2 className="text-lg font-semibold">
          {m['directory.submit_success_title']()}
        </h2>
        <p className="text-muted-foreground max-w-md text-sm">
          {selectedTier === 'premium'
            ? m['directory.submit_success_desc_fast']({
                name,
                days: 30,
              })
            : m['directory.submit_success_desc_free']({
                name,
              })}
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Link
            to={'/settings/submissions' as any}
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-medium transition"
          >
            {m['directory.submit_view_submissions']()}
          </Link>
          <button
            type="button"
            onClick={() => {
              setIsSubmitted(false);
              setName('');
              setWebsiteUrl('');
              setTagline('');
              setCategoryId('');
              setDescription('');
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
        {/* Form Fields & Preview Split Section */}
        <section className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <SubmitFormFields
            name={name}
            setName={setName}
            websiteUrl={websiteUrl}
            setWebsiteUrl={setWebsiteUrl}
            tagline={tagline}
            setTagline={setTagline}
            categoryId={categoryId}
            setCategoryId={setCategoryId}
            description={description}
            setDescription={setDescription}
            categories={categories}
          />
          <SubmitFormPreview name={name} tagline={tagline} />
        </section>

        <SubmitFormTiers
          selectedTier={selectedTier}
          setSelectedTier={setSelectedTier}
        />

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || checkout.pending}
          className="bg-primary text-primary-foreground hover:bg-primary/80 mt-8 inline-flex h-9 w-full shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-transparent bg-clip-padding px-6 text-sm font-medium whitespace-nowrap transition-all outline-none select-none disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
        >
          {isSubmitting || checkout.pending
            ? m['common.pricing.processing']()
            : selectedTier === 'premium'
              ? m['dir.submit.btn_pay']({ price: tierObj.price })
              : m['dir.submit.btn_review']()}
        </button>
      </form>

      <SubmitFormFaq
        openFaqIndex={openFaqIndex}
        setOpenFaqIndex={setOpenFaqIndex}
      />
      <PaymentProviderModal {...checkout.pickerProps} />
    </>
  );
}
