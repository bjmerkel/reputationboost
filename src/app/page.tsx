import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import ValueChain from "@/components/ValueChain";
import ReputationScore from "@/components/ReputationScore";
import LocalPack from "@/components/LocalPack";
import Features from "@/components/Features";
import HowItWorks from "@/components/HowItWorks";
import Testimonial from "@/components/Testimonial";
import PricingPreview from "@/components/PricingPreview";
import FAQ from "@/components/FAQ";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Reputation Boost Score | Free Google Maps GBP Audit",
  description:
    "Get your free Reputation Boost Score. We audit your Google Business Profile, track keyword rankings, build your action plan, and prove the revenue from calls, directions, and profile views.",
};

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <ValueChain />
        <ReputationScore />
        <LocalPack />
        <Features />
        <HowItWorks />
        <Testimonial />
        <PricingPreview />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
