import SectionHeader from "@/components/marketing/SectionHeader";

const features = [
  {
    id: "ai-keywords",
    title: "AI Keyword Discovery",
    description:
      "We analyze your business and AI-pick the keywords your customers actually search — service + city, \"near me,\" emergency terms — automatically.",
    gradient: "from-emerald-500 to-teal-500",
    preview: (
      <div className="space-y-1.5">
        {["emergency plumber austin", "water heater repair", "drain cleaning near me"].map((kw) => (
          <div key={kw} className="flex items-center justify-between rounded-md bg-white/5 px-2.5 py-1.5 text-xs">
            <span className="text-slate-300">{kw}</span>
            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">AI pick</span>
          </div>
        ))}
      </div>
    ),
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    ),
  },
  {
    id: "heatmap",
    title: "Geo-Grid Heatmap",
    description:
      "See where you dominate and where competitors steal clicks — rankings at 1, 3, 5, and 10 miles from your location.",
    gradient: "from-cyan-500 to-blue-500",
    preview: (
      <div className="relative flex h-24 items-center justify-center overflow-hidden rounded-md bg-slate-800/80">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full border border-emerald-500/30"
            style={{ width: `${(i + 1) * 40}px`, height: `${(i + 1) * 40}px` }}
          />
        ))}
        <div className="relative z-10 h-4 w-4 rounded-full bg-emerald-500" />
        <div className="absolute bottom-1.5 left-1.5 flex gap-1">
          {["1mi", "3mi", "5mi", "10mi"].map((r) => (
            <span key={r} className="rounded bg-white/10 px-1 py-0.5 text-[9px] text-slate-400">{r}</span>
          ))}
        </div>
      </div>
    ),
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
      </svg>
    ),
  },
  {
    id: "keyword-cards",
    title: "Keyword Score Cards",
    description:
      "Per-keyword visibility, relevance, and revenue capture — plus estimated monthly revenue if you hit #1.",
    gradient: "from-violet-500 to-purple-500",
    preview: (
      <div className="rounded-md border border-white/5 bg-white/[0.03] p-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-300">&ldquo;emergency plumber&rdquo;</span>
          <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-medium text-red-400">#8</span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[9px]">
          <div><span className="text-slate-500">Vis</span><br /><span className="font-bold text-white">34</span></div>
          <div><span className="text-slate-500">Rel</span><br /><span className="font-bold text-white">61</span></div>
          <div><span className="text-slate-500">Rev</span><br /><span className="font-bold text-white">22</span></div>
        </div>
        <p className="mt-1.5 text-[10px] font-medium text-emerald-400">$2,400/mo at #1</p>
      </div>
    ),
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    id: "competitors",
    title: "Competitor Benchmarking",
    description:
      "Top 5 competitors per keyword — their rankings, ratings, and review counts — with an AI summary of why they win clicks.",
    gradient: "from-rose-500 to-pink-500",
    preview: (
      <div className="space-y-1">
        {[
          { name: "Austin Pro Plumbing", rank: "#1", reviews: "412" },
          { name: "Quick Fix Plumbing", rank: "#2", reviews: "287" },
          { name: "Your Business", rank: "#8", reviews: "47", you: true },
        ].map((c) => (
          <div key={c.name} className={`flex items-center justify-between rounded-md px-2 py-1 text-[10px] ${c.you ? "bg-orange-500/10 border border-orange-500/20" : "bg-white/5"}`}>
            <span className={c.you ? "font-medium text-orange-300" : "text-slate-400"}>{c.name}</span>
            <span className="text-slate-500">{c.rank} · {c.reviews} reviews</span>
          </div>
        ))}
      </div>
    ),
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
  },
  {
    id: "scheduled-ranks",
    title: "Smart Rank Tracking",
    description:
      "Rank pulses run twice monthly, with deeper monthly service-area scans. See pack entry, position changes, and trends without wasteful daily searches.",
    gradient: "from-amber-500 to-orange-500",
    preview: (
      <div className="flex items-end justify-between gap-1 px-1">
        {[18, 14, 11, 8, 5, 3, 3].map((rank, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <div
              className="w-4 rounded-t bg-emerald-500/60"
              style={{ height: `${(20 - rank) * 3}px` }}
            />
            <span className="text-[8px] text-slate-600">{["M", "T", "W", "T", "F", "S", "S"][i]}</span>
          </div>
        ))}
        <span className="text-[10px] font-medium text-emerald-400">#8→#3</span>
      </div>
    ),
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
      </svg>
    ),
  },
  {
    id: "ai-discovery",
    title: "AI Discovery Tracking",
    description:
      "See whether ChatGPT and Google AI Overviews recommend your business for \"best service near me\" — and who they recommend instead.",
    gradient: "from-sky-500 to-indigo-500",
    preview: (
      <div className="space-y-1.5">
        {[
          { surface: "ChatGPT", status: "Mentioned #2", good: true },
          { surface: "AI Overviews", status: "Not mentioned", good: false },
        ].map((row) => (
          <div key={row.surface} className="flex items-center justify-between rounded-md bg-white/5 px-2.5 py-1.5 text-xs">
            <span className="text-slate-300">{row.surface}</span>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${row.good ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
              {row.status}
            </span>
          </div>
        ))}
      </div>
    ),
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
      </svg>
    ),
  },
  {
    id: "impressions",
    title: "Search Impressions",
    description:
      "Know how many people searched for your business on Google Maps and Search — pulled from your connected GBP.",
    gradient: "from-indigo-500 to-violet-500",
    preview: (
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md bg-white/5 p-2 text-center">
          <p className="text-lg font-bold text-white">1,247</p>
          <p className="text-[9px] text-slate-500">Maps views</p>
        </div>
        <div className="rounded-md bg-white/5 p-2 text-center">
          <p className="text-lg font-bold text-white">834</p>
          <p className="text-[9px] text-slate-500">Search views</p>
        </div>
        <div className="col-span-2 rounded-md bg-emerald-500/10 p-1.5 text-center text-[10px] text-emerald-400">
          +18% vs last month
        </div>
      </div>
    ),
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    id: "score-changelog",
    title: "Score Changelog",
    description:
      "Day-over-day Reputation Boost Score movement — see exactly what changed and why your score went up or down.",
    gradient: "from-teal-500 to-emerald-500",
    preview: (
      <div className="space-y-1.5">
        {[
          { text: "Added 12 photos", delta: "+6 pts", up: true },
          { text: "Keyword moved #8 → #3", delta: "+4 pts", up: true },
          { text: "No post in 14 days", delta: "-2 pts", up: false },
        ].map((entry) => (
          <div key={entry.text} className="flex items-center justify-between text-[10px]">
            <span className="text-slate-400">{entry.text}</span>
            <span className={entry.up ? "font-medium text-emerald-400" : "font-medium text-red-400"}>{entry.delta}</span>
          </div>
        ))}
      </div>
    ),
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: "path-to-healthy",
    title: "Path to Healthy",
    description:
      "Your personalized route from current score to 70+ with projected revenue gain and prioritized actions.",
    gradient: "from-lime-500 to-green-500",
    preview: (
      <div>
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-orange-400 font-bold">47</span>
          <span className="text-slate-500">→</span>
          <span className="text-emerald-400 font-bold">72</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-[65%] rounded-full bg-gradient-to-r from-orange-500 to-emerald-500" />
        </div>
        <p className="mt-1.5 text-[10px] font-medium text-emerald-400">+$4,200/mo estimated</p>
      </div>
    ),
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export default function Features() {
  return (
    <section id="features" className="relative scroll-mt-28 py-24 lg:py-32">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/[0.03] to-transparent" />

      <div className="relative mx-auto max-w-6xl px-6">
        <SectionHeader
          label="Keyword Intelligence"
          labelColor="emerald"
          title={
            <>
              Know where you rank, what it costs, and{" "}
              <span className="gradient-text">what to fix</span>
            </>
          }
          subtitle="Nine data layers that power your Reputation Boost Score — from keyword discovery to Maps rank tracking, AI answer visibility, and revenue projections."
        />

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <article
              key={feature.id}
              id={feature.id}
              className="feature-card group relative flex flex-col overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02] p-6"
            >
              <div
                className={`feature-icon mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${feature.gradient} text-white shadow-lg`}
              >
                {feature.icon}
              </div>

              <h3 className="text-lg font-bold text-white">{feature.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">
                {feature.description}
              </p>

              <div className="mt-4 rounded-lg border border-white/5 bg-slate-900/50 p-3">
                {feature.preview}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
