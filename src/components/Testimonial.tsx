export default function Testimonial() {
  return (
    <section className="relative py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="gradient-border overflow-hidden rounded-3xl">
          <div className="relative rounded-[calc(1.5rem-1px)] bg-gradient-to-br from-slate-900/80 to-slate-900/40 px-8 py-16 text-center lg:px-16">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.08),transparent_60%)]" />

            <div className="relative">
              <svg
                className="mx-auto h-10 w-10 text-emerald-500/40"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.432.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
              </svg>

              <blockquote className="mx-auto mt-8 max-w-3xl text-xl font-medium leading-relaxed text-slate-300 sm:text-2xl">
                &ldquo;Reputation Boost has helped us protect and improve our
                company&apos;s online presence. It&apos;s been a key part of building
                trust with customers searching for car shipping to Canada.&rdquo;
              </blockquote>

              <div className="mt-8 flex items-center justify-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 text-lg font-bold text-white">
                  D
                </div>
                <div className="text-left">
                  <div className="font-semibold text-white">Dion</div>
                  <div className="text-sm text-slate-400">
                    Owner, US Canada Auto Transport
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
