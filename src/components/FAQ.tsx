"use client";

import { useState } from "react";
import { marketingFaqs } from "@/lib/marketing-faq";
import SectionHeader from "@/components/marketing/SectionHeader";

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="scroll-mt-28 border-b border-[#dadce0] bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
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
                className="overflow-hidden rounded-xl border border-[#dadce0] bg-[#f8f9fa]"
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  aria-expanded={isOpen}
                >
                  <span className="font-semibold text-[#202124]">{faq.question}</span>
                  <svg
                    className={`h-5 w-5 shrink-0 text-[#80868b] transition-transform ${isOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isOpen && (
                  <div className="border-t border-[#dadce0] px-6 py-4">
                    <p className="text-sm leading-relaxed text-[#5f6368]">{faq.answer}</p>
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
