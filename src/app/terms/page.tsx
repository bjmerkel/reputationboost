import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Terms of Service | Reputation Boost",
  description: "Terms of Service for Reputation Boost Google Business Profile optimization services.",
};

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-32 pb-20">
        <div className="mx-auto max-w-3xl px-6">
          <h1 className="text-4xl font-extrabold text-white">Terms of Service</h1>
          <p className="mt-4 text-sm text-slate-500">Last updated: July 2026</p>

          <div className="prose prose-invert mt-10 space-y-6 text-slate-400">
            <p>
              By using Reputation Boost (&ldquo;Service&rdquo;), you agree to these Terms of
              Service. Please read them carefully.
            </p>

            <section>
              <h2 className="text-xl font-bold text-white">Service Description</h2>
              <p className="mt-3">
                Reputation Boost provides Google Business Profile auditing, scoring, keyword
                rank tracking, AI-generated optimization plans, and execution of approved
                profile changes. Our focus is exclusively on GBP and Google Maps optimization.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white">No Ranking Guarantees</h2>
              <p className="mt-3">
                We do not guarantee specific search rankings or revenue outcomes. We provide
                data-driven recommendations, daily tracking, and attribution reporting. Results
                vary based on competition, market, and profile starting point.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white">Account & Billing</h2>
              <p className="mt-3">
                Plans are billed monthly. You may cancel at any time. Upon cancellation, access
                to premium features ends at the close of your billing period.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white">Your Responsibilities</h2>
              <p className="mt-3">
                You are responsible for maintaining accurate business information, approving
                content before publication, and ensuring you have authority to manage the
                connected Google Business Profile.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white">Contact</h2>
              <p className="mt-3">
                Questions about these terms? Email{" "}
                <a href="mailto:info@reputationboost.com" className="text-emerald-400 hover:text-emerald-300">
                  info@reputationboost.com
                </a>
                .
              </p>
            </section>
          </div>

          <p className="mt-12">
            <Link href="/" className="text-sm text-emerald-400 hover:text-emerald-300">
              ← Back to home
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
