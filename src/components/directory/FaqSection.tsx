import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';

import { FAQ_ITEMS, tr } from '@/lib/directory-data';
import { m } from '@/paraglide/messages.js';

export function FaqSection() {
  const [openIndices, setOpenIndices] = useState<number[]>([]);

  const toggleIndex = (idx: number) => {
    setOpenIndices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  return (
    <section className="border-border mt-14 grid gap-8 border-t pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      {/* About Box */}
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          {m['directory.about_title']()}
        </h2>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          {m['directory.about_p1']()}
        </p>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          {m['directory.about_p2']()}
        </p>
        <Link
          to="/submit"
          className="text-foreground mt-4 inline-flex items-center gap-1 text-sm font-medium hover:underline"
        >
          {m['directory.submit_your_tool']()}
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      {/* FAQ Accordion */}
      <div>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">
          {m['directory.questions_title']()}
        </h2>
        <div className="border-border flex w-full flex-col border-t">
          {FAQ_ITEMS.map((faq, idx) => {
            const isOpen = openIndices.includes(idx);
            const question = tr(faq.questionKey);
            const answer = tr(faq.answerKey);
            return (
              <div
                key={faq.questionKey}
                className="border-border border-b transition-colors"
              >
                <h3>
                  <button
                    type="button"
                    onClick={() => toggleIndex(idx)}
                    aria-expanded={isOpen}
                    className="hover:text-primary flex w-full cursor-pointer items-start justify-between py-4 text-left text-[15px] font-medium transition-colors outline-none"
                  >
                    <span className="pr-4">{question}</span>
                    {isOpen ? (
                      <ChevronUp className="text-muted-foreground size-4 shrink-0" />
                    ) : (
                      <ChevronDown className="text-muted-foreground size-4 shrink-0" />
                    )}
                  </button>
                </h3>
                {isOpen && (
                  <div className="text-muted-foreground animate-in fade-in-50 pb-4 text-sm leading-relaxed duration-150">
                    {answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
