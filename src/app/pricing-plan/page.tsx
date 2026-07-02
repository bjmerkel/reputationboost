import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import PricingPlans from "@/components/PricingPlans";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Pricing | Reputation Boost",
  description:
    "Straightforward, transparent pricing for Google Business Profile optimization. Keyword, Omni, and Spectrum plans starting at $150/month.",
  openGraph: {
    title: "Pricing | Reputation Boost",
    description:
      "Fair, transparent pricing for Google Maps ranking and GBP optimization tools.",
    url: "https://reputationboost.com/pricing-plan",
  },
};

export default function PricingPage() {
  return (
    <>
      <Navbar />
      <main className="relative overflow-hidden pt-32 pb-24 lg:pt-40">
        <div className="mesh-bg absolute inset-0" />
        <div className="grid-pattern absolute inset-0 opacity-30" />
        <div className="pointer-events-none absolute -top-20 left-1/2 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
              Pricing
            </span>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Straightforward rates{" "}
              <span className="gradient-text">you can trust</span>
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-slate-400">
              Our pricing is designed to be fair, transparent, and easy to
              understand. Know exactly what you&apos;re paying for — no hidden
              fees, no surprises.
            </p>
          </div>

          <div className="mt-16">
            <PricingPlans />
          </div>

          <div className="mt-16 rounded-2xl border border-white/8 bg-white/[0.02] p-8 text-center lg:p-12">
            <h2 className="text-2xl font-bold text-white">
              All plans include Google Business Profile optimization
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-slate-400">
              Every plan is built to help you rank higher on Google Maps, break
              into the Local 3-Pack, and turn searches into calls, direction
              requests, and website visits.
            </p>
            <p className="mt-6 text-sm text-slate-500">
              Questions about which plan is right for you?{" "}
              <a
                href="mailto:info@reputationboost.com"
                className="text-emerald-400 transition-colors hover:text-emerald-300"
              >
                Contact our team
              </a>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
