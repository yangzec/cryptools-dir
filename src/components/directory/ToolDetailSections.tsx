import { Check, ChevronDown, Minus } from 'lucide-react';

import { m } from '@/paraglide/messages.js';

type FeatureItem = { title: string; description: string };
type FaqItem = { question: string; answer: string };

export function ToolDetailSections({
  toolName,
  overviewContent,
  howToUse,
  howToUseSteps,
  features,
  useCases,
  pros,
  cons,
  faqs,
  openFaqIndex,
  setOpenFaqIndex,
}: {
  toolName: string;
  overviewContent: string | null | undefined;
  howToUse: string | null | undefined;
  howToUseSteps: string[];
  features: FeatureItem[];
  useCases: FeatureItem[];
  pros: string[];
  cons: string[];
  faqs: FaqItem[];
  openFaqIndex: number | null;
  setOpenFaqIndex: (index: number | null) => void;
}) {
  return (
    <div className="space-y-12">
      {/* Overview / What is */}
      {overviewContent && (
        <section id="what-is" className="directory-detail-section">
          <h2 className="mb-4 text-xl font-semibold tracking-tight">
            {m['directory.detail.what_is']({ name: toolName })}
          </h2>
          <div className="text-foreground/90 text-[15px] leading-7 leading-relaxed whitespace-pre-line">
            <p>{overviewContent}</p>
          </div>
        </section>
      )}

      {/* How to use */}
      {howToUse && (
        <section id="how-to-use" className="directory-detail-section">
          <h2 className="mb-4 text-xl font-semibold tracking-tight">
            {m['directory.detail.how_to_use_title']({
              name: toolName,
            })}
          </h2>
          <div className="text-foreground/90 text-[15px] leading-7">
            {howToUseSteps.length > 0 ? (
              <ol className="marker:text-muted-foreground ml-6 list-decimal space-y-1.5">
                {howToUseSteps.map((step, idx) => (
                  <li key={idx} className="leading-7">
                    {step}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="leading-relaxed whitespace-pre-line">{howToUse}</p>
            )}
          </div>
        </section>
      )}

      {/* Key Features */}
      {features.length > 0 && (
        <section id="features" className="directory-detail-section">
          <h2 className="mb-4 text-xl font-semibold tracking-tight">
            {m['directory.detail.key_features']({ name: toolName })}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {features.map((item, idx) => (
              <li
                key={idx}
                className="border-border bg-card flex gap-3 rounded-xl border p-4"
              >
                <span className="bg-primary/10 text-primary grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums">
                  {idx + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="text-[15px] leading-snug font-semibold">
                    {item.title}
                  </h3>
                  <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Use Cases */}
      {useCases.length > 0 && (
        <section id="use-cases" className="directory-detail-section">
          <h2 className="mb-4 text-xl font-semibold tracking-tight">
            {m['directory.detail.use_cases_title']({ name: toolName })}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {useCases.map((item, idx) => (
              <li
                key={idx}
                className="border-border bg-card flex gap-3 rounded-xl border p-4"
              >
                <span className="bg-primary/10 text-primary grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums">
                  {idx + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="text-[15px] leading-snug font-semibold">
                    {item.title}
                  </h3>
                  <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Pros & Cons */}
      {(pros.length > 0 || cons.length > 0) && (
        <section id="pros-cons" className="directory-detail-section">
          <h2 className="mb-4 text-xl font-semibold tracking-tight">
            {m['directory.detail.pros_cons_title']({ name: toolName })}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Pros Card */}
            <div className="border-border bg-card rounded-xl border p-4">
              <p className="mb-3 text-sm font-semibold">
                {m['directory.pros']()}
              </p>
              <ul className="space-y-2.5">
                {pros.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex gap-2.5 text-sm leading-relaxed"
                  >
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
                      <Check className="size-3.5" />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Cons Card */}
            <div className="border-border bg-card rounded-xl border p-4">
              <p className="mb-3 text-sm font-semibold">
                {m['directory.cons']()}
              </p>
              <ul className="space-y-2.5">
                {cons.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex gap-2.5 text-sm leading-relaxed"
                  >
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-rose-500/12 text-rose-600 dark:text-rose-400">
                      <Minus className="size-3.5" />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* FAQ Accordion */}
      {faqs.length > 0 && (
        <section id="faq" className="directory-detail-section">
          <h2 className="mb-4 text-xl font-semibold tracking-tight">
            {m['directory.detail.faq_title']({ name: toolName })}
          </h2>
          <div className="border-border flex w-full flex-col border-t">
            {faqs.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={idx}
                  className="border-border border-b transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="hover:text-primary flex w-full cursor-pointer items-center justify-between py-4 text-left text-[15px] font-medium transition"
                  >
                    <span>{faq.question}</span>
                    <ChevronDown
                      className={`text-muted-foreground size-4 transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="text-muted-foreground animate-in fade-in pb-4 text-sm leading-relaxed whitespace-pre-line duration-150">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
