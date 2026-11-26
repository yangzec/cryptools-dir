import { Check, ChevronDown, Crown } from 'lucide-react';

import {
  SUBMIT_FAQ_ITEMS,
  SUBMIT_STEP_KEYS,
  SUBMIT_TIERS,
  tr,
} from '@/lib/directory-data';
import { m } from '@/paraglide/messages.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export function SubmitFormFields({
  name,
  setName,
  websiteUrl,
  setWebsiteUrl,
  tagline,
  setTagline,
  categoryId,
  setCategoryId,
  description,
  setDescription,
  categories = [],
}: {
  name: string;
  setName: (v: string) => void;
  websiteUrl: string;
  setWebsiteUrl: (v: string) => void;
  tagline: string;
  setTagline: (v: string) => void;
  categoryId: string;
  setCategoryId: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  categories?: Array<{ id: string; name: string; slug?: string }>;
}) {
  return (
    <div className="space-y-5">
      {/* Name */}
      <div className="space-y-2">
        <label htmlFor="tool-name" className="text-sm leading-none font-medium">
          {m['dir.submit.field_name']()}
        </label>
        <input
          id="tool-name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={m['dir.submit.field_name_ph']()}
          className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full min-w-0 rounded-lg border bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:ring-3"
        />
      </div>

      {/* Website */}
      <div className="space-y-2">
        <label
          htmlFor="tool-website"
          className="text-sm leading-none font-medium"
        >
          {m['dir.submit.field_website']()}
        </label>
        <input
          id="tool-website"
          type="url"
          required
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          placeholder={m['dir.submit.field_website_ph']()}
          className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full min-w-0 rounded-lg border bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:ring-3"
        />
      </div>

      {/* Tagline */}
      <div className="space-y-2">
        <label
          htmlFor="tool-tagline"
          className="text-sm leading-none font-medium"
        >
          {m['dir.submit.field_tagline']()}
        </label>
        <input
          id="tool-tagline"
          type="text"
          maxLength={200}
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          placeholder={m['dir.submit.field_tagline_ph']()}
          className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full min-w-0 rounded-lg border bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:ring-3"
        />
      </div>

      {/* Category */}
      <div className="space-y-2">
        <label
          htmlFor="tool-category"
          className="text-sm leading-none font-medium"
        >
          {m['dir.submit.field_category']()}
        </label>
        <Select
          value={categoryId || undefined}
          onValueChange={(next) => {
            if (!next) return;
            setCategoryId(String(next));
          }}
        >
          <SelectTrigger
            id="tool-category"
            size="sm"
            className="h-8 w-full"
            aria-label={m['dir.submit.field_category']()}
          >
            <SelectValue placeholder={m['dir.submit.field_category_ph']()} />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Introduction (optional) */}
      <div className="space-y-2">
        <label
          htmlFor="tool-intro"
          className="text-sm leading-none font-medium"
        >
          {m['dir.submit.field_intro']()}
        </label>
        <Textarea
          id="tool-intro"
          rows={6}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={m['dir.submit.field_intro_ph']()}
        />
      </div>
    </div>
  );
}

export function SubmitFormPreview({
  name,
  tagline,
}: {
  name: string;
  tagline: string;
}) {
  return (
    <div className="space-y-6">
      {/* Live Preview Card */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">
          {m['dir.submit.preview_title']()}
        </h2>
        <div className="pointer-events-none" aria-hidden="true">
          <div className="group border-border bg-card relative flex flex-col rounded-xl border p-4 transition">
            <div className="flex items-start gap-3">
              <div
                className="border-border/60 bg-secondary/50 shrink-0 overflow-hidden rounded-lg border"
                style={{ width: 44, height: 44 }}
              >
                <div className="from-primary/15 to-primary/5 text-primary grid size-full place-items-center bg-gradient-to-br">
                  <span className="font-semibold" style={{ fontSize: 14.67 }}>
                    {name ? name.slice(0, 2).toUpperCase() : 'EG'}
                  </span>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h3 className="min-w-0 truncate text-[15px] leading-tight font-semibold">
                    <span className="after:absolute after:inset-0 after:rounded-xl">
                      {name || m['dir.submit.field_name_ph']()}
                    </span>
                  </h3>
                </div>
                <p className="text-muted-foreground mt-1 line-clamp-2 min-h-10 text-[13px] leading-5">
                  {tagline || m['dir.submit.field_tagline_ph']()}
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2" />
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="border-border rounded-2xl border p-5">
        <h3 className="mb-3 text-sm font-semibold">
          {m['dir.submit.how_it_works']()}
        </h3>
        <ol className="space-y-2.5">
          {SUBMIT_STEP_KEYS.map((sKey, idx) => (
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
        <p className="border-border text-muted-foreground mt-4 flex items-start gap-2 border-t pt-3 text-xs">
          <Crown className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
          <span>{m['dir.submit.premium_skips_queue']()}</span>
        </p>
      </div>
    </div>
  );
}

export function SubmitFormTiers({
  selectedTier,
  setSelectedTier,
}: {
  selectedTier: string;
  setSelectedTier: (id: string) => void;
}) {
  return (
    <section className="mt-10">
      <h2 className="mb-4 text-lg font-semibold">
        {m['dir.submit.listing_plan']()}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {SUBMIT_TIERS.map((tier) => {
          const isSelected = selectedTier === tier.id;
          return (
            <button
              key={tier.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => setSelectedTier(tier.id)}
              className={`flex cursor-pointer flex-col rounded-xl border p-4 text-left transition ${
                isSelected
                  ? 'border-primary ring-primary/30 ring-2'
                  : 'border-border hover:border-primary/40'
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  {tier.id === 'premium' && (
                    <Crown className="size-4 text-amber-500" />
                  )}
                  <span>{tr(tier.nameKey)}</span>
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {tier.price}
                </span>
              </span>
              <ul className="text-muted-foreground mt-3 space-y-1.5 text-xs">
                {tier.featureKeys.map((fKey, i) => (
                  <li key={i} className="flex gap-1.5">
                    <Check className="mt-px size-3.5 shrink-0" />
                    <span>{tr(fKey)}</span>
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function SubmitFormFaq({
  openFaqIndex,
  setOpenFaqIndex,
}: {
  openFaqIndex: number | null;
  setOpenFaqIndex: (index: number | null) => void;
}) {
  return (
    <section className="mt-16 max-w-3xl pb-4">
      <h2 className="mb-4 text-lg font-semibold">
        {m['dir.submit.faq_title']()}
      </h2>
      <div className="border-border flex flex-col border-b">
        {SUBMIT_FAQ_ITEMS.map((faq, i) => {
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
                  {tr(faq.answerKey, faq.params)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
