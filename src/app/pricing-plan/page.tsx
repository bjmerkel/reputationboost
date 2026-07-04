import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import PricingPlans from "@/components/PricingPlans";
import Footer from "@/components/Footer";
import SectionHeader from "@/components/marketing/SectionHeader";

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
    <div className="marketing-theme min-h-screen bg-[#f8f9fa]">
      <Navbar />
      <main className="py-12 lg:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeader
            label="Pricing"
            labelColor="emerald"
            title={
              <>
                Straightforward rates{" "}
                <span className="gradient-text font-semibold">you can trust</span>
              </>
            }
            subtitle="Our pricing is designed to be fair, transparent, and easy to understand. Know exactly what you're paying for — no hidden fees, no surprises."
          />

          <div className="mt-12">
            <PricingPlans />
          </div>

          <div className="mt-12 maps-card p-8 text-center lg:p-12">
            <h2 className="text-2xl font-medium text-[#202124]">
              All plans include Google Business Profile optimization
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-[#5f6368]">
              Every plan is built to help you rank higher on Google Maps, break
              into the Local 3-Pack, and turn searches into calls, direction
              requests, and website visits.
            </p>
            <p className="mt-6 text-sm text-[#80868b]">
              Questions about which plan is right for you?{" "}
              <a
                href="mailto:info@reputationboost.com"
                className="text-[#1a73e8] hover:underline"
              >
                Contact our team
              </a>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
