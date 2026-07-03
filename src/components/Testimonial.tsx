const testimonials = [
  {
    quote:
      "We went from score 41 to 74 in three months. Calls are up 40% and we finally broke into the Local 3-Pack for our main keyword.",
    name: "Marcus T.",
    role: "Owner, Austin Pro Plumbing",
    initial: "M",
    gradient: "from-emerald-400 to-cyan-500",
  },
  {
    quote:
      "The action plan told us exactly what to fix — photos, description, review responses. We didn't have to guess anymore.",
    name: "Dr. Sarah Chen",
    role: "Practice Manager, Bright Smile Dental",
    initial: "S",
    gradient: "from-violet-400 to-purple-500",
  },
  {
    quote:
      "Reputation Boost has helped us protect and improve our company's online presence. It's been key to building trust with customers searching for car shipping to Canada.",
    name: "Dion",
    role: "Owner, US Canada Auto Transport",
    initial: "D",
    gradient: "from-cyan-400 to-blue-500",
  },
];

const caseStudies = [
  {
    vertical: "Home Services",
    business: "HVAC contractor, Phoenix",
    scoreBefore: 38,
    scoreAfter: 71,
    keyword: "ac repair phoenix",
    rankBefore: "#11",
    rankAfter: "Map #2",
    revenue: "+$3,800/mo",
  },
  {
    vertical: "Dental",
    business: "Family dentist, Denver",
    scoreBefore: 52,
    scoreAfter: 78,
    keyword: "dentist near me",
    rankBefore: "#6",
    rankAfter: "Map #1",
    revenue: "+$2,100/mo",
  },
  {
    vertical: "Legal",
    business: "Personal injury firm, Miami",
    scoreBefore: 44,
    scoreAfter: 69,
    keyword: "car accident lawyer miami",
    rankBefore: "#9",
    rankAfter: "Map #3",
    revenue: "+$5,200/mo",
  },
];

export default function Testimonial() {
  return (
    <section id="testimonials" className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
            Social Proof
          </span>
          <h2 className="mt-4 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Real businesses.{" "}
            <span className="gradient-text">Real score improvements.</span>
          </h2>
        </div>

        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          {testimonials.map((t) => (
            <article
              key={t.name}
              className="gradient-border flex flex-col overflow-hidden rounded-2xl"
            >
              <div className="flex flex-1 flex-col rounded-[calc(1rem-1px)] bg-slate-900/60 p-6">
                <svg
                  className="h-8 w-8 text-emerald-500/30"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.432.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                </svg>

                <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-slate-300">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>

                <div className="mt-6 flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${t.gradient} text-sm font-bold text-white`}
                  >
                    {t.initial}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{t.name}</div>
                    <div className="text-xs text-slate-500">{t.role}</div>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-16">
          <h3 className="text-center text-lg font-bold text-white">Score improvements by vertical</h3>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {caseStudies.map((cs) => (
              <article
                key={cs.business}
                className="rounded-2xl border border-white/8 bg-white/[0.02] p-6"
              >
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  {cs.vertical}
                </span>
                <p className="mt-1 text-sm text-slate-500">{cs.business}</p>

                <div className="mt-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-orange-500 text-sm font-bold text-orange-400">
                    {cs.scoreBefore}
                  </div>
                  <svg className="h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-emerald-500 text-sm font-bold text-emerald-400">
                    {cs.scoreAfter}
                  </div>
                </div>

                <div className="mt-4 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>&ldquo;{cs.keyword}&rdquo;</span>
                    <span>
                      <span className="text-red-400">{cs.rankBefore}</span>
                      {" → "}
                      <span className="text-emerald-400">{cs.rankAfter}</span>
                    </span>
                  </div>
                  <p className="font-semibold text-emerald-400">{cs.revenue} estimated</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
