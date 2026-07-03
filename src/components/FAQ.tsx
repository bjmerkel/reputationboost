"use client";

import { useState } from "react";
import { marketingFaqs } from "@/lib/marketing-faq";
import SectionHeader from "@/components/marketing/SectionHeader";

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="relative scroll-mt-28 py-24 lg:py-32">
      <div className="mx-auto max-w-3xl px-6">
        <SectionHeader
          label="FAQ"
          labelColor="violet"
          title="Common questions"
          subtitle="Everything you need to know before getting your score."
        />

        <div className="mt-12 space-y-3">
          {marketingFaqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={faq.question}
                className="overflow-hidden rounded-xl border border-white/8 bg-white/[0.02]"
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  aria-expanded={isOpen}
                >
                  <span className="font-semibold text-white">{faq.question}</span>
                  <svg
                    className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isOpen && (
                  <div className="border-t border-white/5 px-6 py-4">
                    <p className="text-sm leading-relaxed text-slate-400">{faq.answer}</p>
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
