import SectionHeader from "@/components/marketing/SectionHeader";

const loopSteps = [
  {
    title: "See where you're weak",
    description:
      "Your service-area map shows which keywords and neighborhoods sit outside the Local 3-Pack.",
  },
  {
    title: "Ask the right customers",
    description:
      "After a great job, we text customers from areas where you need visibility — with your approval and opt-out.",
  },
  {
    title: "Prove it worked",
    description:
      "We track rank before and after in each map cell — so your plan focuses on actions that actually move the needle, not generic checklists.",
  },
];

const gridCells = [
  { rank: 4, priority: false },
  { rank: 14, priority: true },
  { rank: 8, priority: false },
  { rank: 18, priority: true },
  { rank: 2, priority: false },
  { rank: 11, priority: false },
  { rank: 7, priority: false },
  { rank: 16, priority: false },
  { rank: 5, priority: false },
];

function cellBackground(rank: number): string {
  if (rank <= 3) return "#e6f4ea";
  if (rank <= 10) return "#fef7e0";
  return "#fce8e6";
}

function cellBorder(rank: number, priority: boolean): string {
  if (priority) return "border-[#1a73e8] ring-2 ring-[#1a73e8]/30";
  if (rank <= 3) return "border-[#ceead6]";
  if (rank <= 10) return "border-[#fdd663]";
  return "border-[#f6aea9]";
}

function cellText(rank: number): string {
  if (rank <= 3) return "text-[#188038]";
  if (rank <= 10) return "text-[#e37400]";
  return "text-[#d93025]";
}

export default function GeoReviewVelocity() {
  return (
    <section id="geo-reviews" className="scroll-mt-28 border-b border-[#dadce0] bg-white py-16 lg:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeader
          label="Execution"
          labelColor="emerald"
          title={
            <>
              Turn weak map areas into{" "}
              <span className="gradient-text font-semibold">reviews that move rankings</span>
            </>
          }
          subtitle="When parts of your service area sit outside the Local 3-Pack, generic review asks don't help. We route requests to customers from those job areas, then measure whether your rank improves there."
        />

        <div className="mt-12 grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <div className="rounded-2xl border border-[#dadce0] bg-[#f8f9fa] p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[#202124]">Service-area map</p>
              <span className="rounded-full bg-[#e8f0fe] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#1a73e8]">
                Priority areas
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {gridCells.map((cell, index) => (
                <div
                  key={index}
                  className={`flex aspect-square flex-col items-center justify-center rounded-lg border ${cellBorder(cell.rank, cell.priority)}`}
                  style={{ backgroundColor: cellBackground(cell.rank) }}
                >
                  <span className={`text-lg font-bold ${cellText(cell.rank)}`}>#{cell.rank}</span>
                  {cell.priority && (
                    <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#1a73e8]">
                      Target
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-[#dadce0] bg-white px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-[#80868b]">emergency plumber</p>
                <p className="mt-0.5 text-sm font-semibold text-[#202124]">
                  Northeast service area
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className="rounded-md bg-[#fce8e6] px-2 py-1 text-[#d93025]">#14</span>
                <span className="text-[#80868b]">→</span>
                <span className="rounded-md bg-[#e6f4ea] px-2 py-1 text-[#188038]">#8</span>
              </div>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-[#80868b]">
              Illustrative example — after geo-targeted review requests, rank movement is measured
              in each map area.
            </p>

            <div className="mt-4 rounded-xl border border-[#d2e3fc] bg-[#e8f0fe] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#1a73e8]">
                Beat the leader
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[#3c4043]">
                For weak cells, we diff your profile against whoever ranks #1 there — reviews,
                photos, categories — and queue a test through your approval list. Nothing publishes
                without you.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {loopSteps.map((step, index) => (
              <article
                key={step.title}
                className="rounded-xl border border-[#dadce0] bg-[#f8f9fa] p-5"
              >
                <div className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e8f0fe] text-sm font-bold text-[#1a73e8]">
                    {index + 1}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-[#202124]">{step.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-[#5f6368]">
                      {step.description}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-10 rounded-xl border border-[#ceead6] bg-[#e6f4ea] px-6 py-4 text-center">
          <p className="text-sm text-[#3c4043]">
            <span className="font-semibold text-[#188038]">Every review is attributed.</span>{" "}
            Every ranking change is measured — so you know what&apos;s working, not just what was
            sent.
          </p>
        </div>
      </div>
    </section>
  );
}
