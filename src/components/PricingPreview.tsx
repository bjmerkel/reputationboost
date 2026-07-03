import Link from "next/link";
import { SIGNUP_URL, SIGNUP_CTA_LABEL } from "@/lib/constants";
import { pricingPlans } from "@/lib/pricing";

export default function PricingPreview() {
  return (
    <section id="pricing" className="relative py-24 lg:py-32">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-violet-500/[0.03] to-transparent" />

      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-sm font-semibold uppercase tracking-widest text-violet-400">
            Pricing
          </span>
          <h2 className="mt-4 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Plans built around your{" "}
            <span className="gradient-text">Reputation Boost Score</span>
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Every plan includes your score audit, AI action plan, GBP optimization
            tools, and a dedicated account manager.
          </p>
        </div>

        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          {pricingPlans.map((plan) => (
            <article
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border p-8 ${
                plan.popular
                  ? "border-emerald-500/40 bg-emerald-500/[0.04] shadow-lg shadow-emerald-500/10"
                  : "border-white/8 bg-white/[0.02]"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-500 px-4 py-1 text-xs font-bold uppercase tracking-wider text-white">
                  Most Popular
                </div>
              )}

              <h3 className="text-xl font-bold text-white">{plan.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                {plan.description}
              </p>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold tracking-tight text-white">
                  ${plan.price}
                </span>
                <span className="text-slate-400">/month</span>
              </div>

              {plan.extras.length > 0 && (
                <ul className="mt-4 space-y-1">
                  {plan.extras.map((extra) => (
                    <li key={extra} className="text-sm text-emerald-300">
                      + {extra}
                    </li>
                  ))}
                </ul>
              )}

              <a
                href={SIGNUP_URL}
                className={`mt-8 inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold ${
                  plan.popular ? "btn-primary text-white" : "btn-secondary text-white"
                }`}
              >
                {SIGNUP_CTA_LABEL}
              </a>
            </article>
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-slate-500">
          <Link href="/pricing-plan" className="text-emerald-400 transition-colors hover:text-emerald-300">
            Compare all features →
          </Link>
        </p>
      </div>
    </section>
  );
}
