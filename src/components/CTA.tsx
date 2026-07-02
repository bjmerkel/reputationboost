import { SIGNUP_URL } from "@/lib/constants";

export default function CTA() {
  return (
    <section id="cta" className="relative py-24 lg:py-32">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-0 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6">
        <div className="gradient-border overflow-hidden rounded-3xl">
          <div className="relative rounded-[calc(1.5rem-1px)] bg-gradient-to-br from-emerald-950/50 via-slate-900 to-cyan-950/30 px-8 py-20 text-center lg:px-20">
            <div className="pointer-events-none absolute inset-0 grid-pattern opacity-30" />

            <div className="relative">
              <h2 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
                Ready to rank in the Local 3-Pack?
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-400">
                Join businesses optimizing their Google Business Profile to
                capture more map clicks, calls, direction requests, and website
                visits.
              </p>

              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <a
                  href={SIGNUP_URL}
                  className="btn-primary inline-flex items-center justify-center gap-2 rounded-full px-10 py-4 text-base font-semibold text-white"
                >
                  Get Free Account
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </a>
                <a
                  href="/pricing-plan"
                  className="btn-secondary inline-flex items-center justify-center gap-2 rounded-full px-10 py-4 text-base font-semibold text-white"
                >
                  View Pricing
                </a>
              </div>

              <p className="mt-6 text-sm text-slate-500">
                No credit card required · Cancel anytime · Setup in minutes
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
