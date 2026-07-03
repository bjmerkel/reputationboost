export default function LocalPack() {
  const clickShare = [
    { position: "#1", share: "40–50%", revenue: "Highest click-share" },
    { position: "#2", share: "30–35%", revenue: "Often wins on reviews" },
    { position: "#3", share: "15–20%", revenue: "Still high-intent traffic" },
  ];

  const actions = [
    {
      label: "Website Clicks",
      share: "50–55%",
      detail: "Users validating menus, pricing, and services before committing",
      color: "bg-emerald-500",
      width: "w-[52%]",
    },
    {
      label: "Direction Requests",
      share: "30–35%",
      detail: "High-intent mobile users planning an immediate visit",
      color: "bg-cyan-500",
      width: "w-[32%]",
    },
    {
      label: "Click-to-Call",
      share: "15–20%",
      detail: "Urgent needs — emergency services, reservations, availability",
      color: "bg-violet-500",
      width: "w-[18%]",
    },
  ];

  return (
    <section id="local-pack" className="relative py-24 lg:py-32">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-emerald-500/[0.04] via-transparent to-transparent" />

      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-sm font-semibold uppercase tracking-widest text-cyan-400">
            The Local 3-Pack
          </span>
          <h2 className="mt-4 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Why ranking in the top 3 on{" "}
            <span className="gradient-text">Google Maps matters</span>
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-400">
            Your Reputation Boost Score tracks exactly where you sit in this pack
            — and what it costs you when you&apos;re outside it.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          {[
            {
              value: "70–75%",
              label: "of map clicks go to the top 3",
            },
            {
              value: "44%",
              label: "of total SERP clicks",
            },
            {
              value: "3×",
              label: "more engagement in the pack",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="gradient-border rounded-2xl p-6 text-center"
            >
              <div className="rounded-[calc(1rem-1px)] bg-slate-900/60 px-4 py-8">
                <div className="text-4xl font-extrabold text-white">{stat.value}</div>
                <div className="mt-2 font-semibold text-emerald-400">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <div className="gradient-border overflow-hidden rounded-2xl">
            <div className="rounded-[calc(1rem-1px)] bg-slate-900/60 p-8">
              <h3 className="text-xl font-bold text-white">
                How users engage with top 3 listings
              </h3>
              <p className="mt-2 text-sm text-slate-400">
                Once a customer clicks your listing, actions are highly
                conversion-focused — and we track every one.
              </p>

              <div className="mt-8 space-y-5">
                {actions.map((action) => (
                  <div key={action.label}>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-300">{action.label}</span>
                      <span className="font-bold text-white">{action.share}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/5">
                      <div
                        className={`h-full rounded-full ${action.color} ${action.width}`}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-slate-500">{action.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="gradient-border overflow-hidden rounded-2xl">
            <div className="rounded-[calc(1rem-1px)] bg-slate-900/60 p-8">
              <h3 className="text-xl font-bold text-white">
                Click share by map position
              </h3>
              <p className="mt-2 text-sm text-slate-400">
                Your Ranking Outcome score weights this click-share curve — so you
                know the revenue impact of every position change.
              </p>

              <div className="mt-8 space-y-4">
                {clickShare.map((item, i) => (
                  <div
                    key={item.position}
                    className="flex items-start gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-4"
                  >
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white ${
                        i === 0
                          ? "bg-gradient-to-br from-amber-400 to-amber-600"
                          : i === 1
                            ? "bg-gradient-to-br from-slate-400 to-slate-600"
                            : "bg-gradient-to-br from-amber-700 to-amber-900"
                      }`}
                    >
                      {item.position}
                    </div>
                    <div>
                      <div className="font-bold text-white">{item.share} of pack clicks</div>
                      <div className="mt-0.5 text-sm text-slate-400">{item.revenue}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <p className="text-sm leading-relaxed text-slate-300">
                  <span className="font-semibold text-emerald-400">The review wildcard: </span>
                  A #2 or #3 listing with 500 reviews often outperforms a #1
                  spot with only 12. Your plan targets exactly these gaps.
                </p>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-slate-600">
          Data sourced from major local SEO studies including BrightLocal, Moz, and SOCi.
        </p>
      </div>
    </section>
  );
}
