import { SIGNUP_URL } from "@/lib/constants";
import { baseFeatures, pricingPlans } from "@/lib/pricing";

function CheckIcon() {
  return (
    <svg
      className="h-5 w-5 shrink-0 text-emerald-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

export default function PricingPlans() {
  return (
    <div className="grid gap-8 lg:grid-cols-3">
      {pricingPlans.map((plan) => (
        <article
          key={plan.id}
          className={`relative flex flex-col rounded-2xl border p-8 transition-all ${
            plan.popular
              ? "border-emerald-500/40 bg-emerald-500/[0.04] shadow-lg shadow-emerald-500/10 lg:scale-105"
              : "border-white/8 bg-white/[0.02]"
          }`}
        >
          {plan.popular && (
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-500 px-4 py-1 text-xs font-bold uppercase tracking-wider text-white">
              Most Popular
            </div>
          )}

          <div
            className={`mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${plan.gradient} text-lg font-bold text-white`}
          >
            {plan.name.charAt(0)}
          </div>

          <h3 className="text-xl font-bold text-white">{plan.name}</h3>
          <p className="mt-2 min-h-[48px] text-sm leading-relaxed text-slate-400">
            {plan.description}
          </p>

          <div className="mt-6 flex items-baseline gap-1">
            <span className="text-5xl font-extrabold tracking-tight text-white">
              ${plan.price}
            </span>
            <span className="text-slate-400">/month</span>
          </div>

          <a
            href={SIGNUP_URL}
            className={`mt-8 inline-flex items-center justify-center rounded-full px-6 py-3.5 text-sm font-semibold transition-all ${
              plan.popular
                ? "btn-primary text-white"
                : "btn-secondary text-white"
            }`}
          >
            Get Free Account
          </a>

          <ul className="mt-8 flex flex-1 flex-col gap-3 border-t border-white/8 pt-8">
            {baseFeatures.map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-sm text-slate-300">
                <CheckIcon />
                {feature}
              </li>
            ))}
            {plan.extras.map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-3 text-sm font-medium text-emerald-300"
              >
                <CheckIcon />
                {feature}
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}
