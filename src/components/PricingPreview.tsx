import Link from "next/link";
import { SIGNUP_URL, SIGNUP_CTA_LABEL } from "@/lib/constants";
import { pricingPlans } from "@/lib/pricing";
import SectionHeader from "@/components/marketing/SectionHeader";

function CheckIcon() {
  return (
    <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#188038]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

export default function PricingPreview() {
  return (
    <section id="pricing" className="scroll-mt-28 border-b border-[#dadce0] bg-[#f8f9fa] py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeader
          label="Pricing"
          labelColor="violet"
          title={
            <>
              Plans built around your{" "}
              <span className="gradient-text font-semibold">Reputation Boost Score</span>
            </>
          }
          subtitle="Every plan includes your score audit, AI action plan, GBP optimization tools, and a dedicated account manager."
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {pricingPlans.map((plan) => (
            <article
              key={plan.id}
              className={`relative flex flex-col rounded-xl border bg-white p-8 ${
                plan.popular
                  ? "border-[#1a73e8] shadow-[0_2px_6px_rgba(60,64,67,0.15)]"
                  : "border-[#dadce0]"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-[#1a73e8] px-4 py-1 text-xs font-bold uppercase tracking-wider text-white">
                  Most Popular
                </div>
              )}

              <h3 className="text-xl font-semibold text-[#202124]">{plan.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#5f6368]">{plan.description}</p>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight text-[#202124]">
                  ${plan.price}
                </span>
                <span className="text-[#80868b]">/month</span>
              </div>

              <ul className="mt-6 flex-1 space-y-2.5">
                {plan.highlights.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-[#3c4043]">
                    <CheckIcon />
                    {feature}
                  </li>
                ))}
                {plan.extras.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm font-medium text-[#1a73e8]">
                    <CheckIcon />
                    {feature}
                  </li>
                ))}
              </ul>

              <a
                href={SIGNUP_URL}
                className={`mt-8 inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold ${
                  plan.popular ? "btn-primary text-white" : "btn-secondary"
                }`}
              >
                {SIGNUP_CTA_LABEL}
              </a>
            </article>
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-[#80868b]">
          <Link href="/pricing-plan" className="text-[#1a73e8] hover:underline">
            Compare all features →
          </Link>
        </p>
      </div>
    </section>
  );
}
