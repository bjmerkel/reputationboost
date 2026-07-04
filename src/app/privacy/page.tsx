import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy | Reputation Boost",
  description: "Privacy Policy for Reputation Boost Google Business Profile optimization services.",
};

export default function PrivacyPage() {
  return (
    <div className="marketing-theme min-h-screen bg-[#f8f9fa]">
      <Navbar />
      <main className="py-12 pb-20">
        <div className="mx-auto max-w-3xl px-6">
          <h1 className="text-4xl font-normal text-[#202124]">Privacy Policy</h1>
          <p className="mt-4 text-sm text-[#80868b]">Last updated: July 2026</p>

          <div className="mt-10 space-y-6 text-[#5f6368]">
            <p>
              Reputation Boost (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) provides
              Google Business Profile optimization services. This Privacy Policy explains how we
              collect, use, and protect your information when you use our website and platform.
            </p>

            <section>
              <h2 className="text-xl font-medium text-[#202124]">Information We Collect</h2>
              <p className="mt-3">
                We collect information you provide directly, including business name, address,
                contact details, target keywords, and Google Business Profile data when you
                connect your account. We also collect usage data and performance metrics from
                your connected GBP account.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-medium text-[#202124]">How We Use Your Information</h2>
              <p className="mt-3">
                We use your information to calculate your Reputation Boost Score, generate
                optimization recommendations, track keyword rankings, execute approved GBP
                changes, and provide attribution reporting on your results.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-medium text-[#202124]">Data Sharing</h2>
              <p className="mt-3">
                We do not sell your personal information. We share data only with service
                providers necessary to operate our platform (e.g., hosting, Google APIs) and
                as required by law.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-medium text-[#202124]">Contact Us</h2>
              <p className="mt-3">
                For privacy-related questions, contact us at{" "}
                <a href="mailto:info@reputationboost.com" className="text-[#1a73e8] hover:underline">
                  info@reputationboost.com
                </a>
                .
              </p>
            </section>
          </div>

          <p className="mt-12">
            <Link href="/" className="text-sm text-[#1a73e8] hover:underline">
              ← Back to home
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
