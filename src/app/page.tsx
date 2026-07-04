import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import MarketingHome from "@/components/marketing/MarketingHome";
import PlatformExplorer from "@/components/marketing/PlatformExplorer";
import ProofNarrative from "@/components/marketing/ProofNarrative";
import NightlyScoreLoop from "@/components/marketing/NightlyScoreLoop";
import WhatWeTrack from "@/components/marketing/WhatWeTrack";
import RoiCalculator from "@/components/marketing/RoiCalculator";
import PricingPreview from "@/components/PricingPreview";
import FAQ from "@/components/FAQ";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";
import MobileStickyCTA from "@/components/marketing/MobileStickyCTA";
import FaqJsonLd from "@/components/marketing/FaqJsonLd";

export const metadata: Metadata = {
  title: "Reputation Boost Score | Free Google Business Profile Audit",
  description:
    "Get your free Reputation Boost Score. Find your business on Google Maps — we audit your Google listing, pick your keywords, build your action plan, and show the revenue from calls, directions, and profile views.",
  openGraph: {
    title: "Reputation Boost Score | Free Google Business Profile Audit",
    description:
      "Get your free Reputation Boost Score. Find your business on Google Maps — we audit your Google listing, pick your keywords, and build a plan to increase calls and revenue.",
    type: "website",
  },
};

export default function Home() {
  return (
    <MarketingHome>
      <div className="marketing-theme min-h-screen bg-[#f8f9fa]">
        <FaqJsonLd />
        <Navbar />
        <main className="marketing-main">
          <Hero />
          <PlatformExplorer />
          <ProofNarrative />
          <RoiCalculator />
          <WhatWeTrack />
          <NightlyScoreLoop />
          <PricingPreview />
          <FAQ />
          <CTA />
        </main>
        <Footer />
        <MobileStickyCTA />
      </div>
    </MarketingHome>
  );
}
