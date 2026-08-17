/** Illustrative dashboard preview for hero — not live client data */
export default function HeroDashboardPreview() {
  return (
    <div className="relative w-full">
      <div className="overflow-hidden rounded-2xl border border-[#dadce0] bg-white shadow-[0_4px_24px_rgba(60,64,67,0.12)]">
        <div className="flex items-center justify-between border-b border-[#dadce0] bg-[#f8f9fa] px-4 py-2.5">
          <span className="text-xs font-medium text-[#5f6368]">Reputation Boost · Dashboard</span>
          <span className="rounded-full bg-[#e6f4ea] px-2 py-0.5 text-[10px] font-semibold text-[#188038]">
            Live example
          </span>
        </div>

        <div className="grid sm:grid-cols-5">
          {/* Score + metrics */}
          <div className="border-b border-[#dadce0] p-4 sm:col-span-2 sm:border-b-0 sm:border-r">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#80868b]">
              Reputation Boost Score
            </p>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-4xl font-semibold text-[#e37400]">47</span>
              <span className="pb-1 text-sm text-[#80868b]">/ 100</span>
            </div>
            <p className="mt-1 text-xs text-[#e37400]">Needs work</p>

            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-[#5f6368]">Est. Maps revenue</span>
                <span className="font-semibold text-[#188038]">+$4,200/mo</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#5f6368]">Top keyword</span>
                <span className="font-medium text-[#202124]">roof repair near me</span>
              </div>
              <div className="rounded-lg border border-[#fce8e6] bg-[#fef7f6] px-2.5 py-2 text-xs text-[#3c4043]">
                <span className="font-medium text-[#d93025]">Top opportunity:</span> Add 12
                service photos
              </div>
            </div>
          </div>

          {/* Map preview */}
          <div className="relative min-h-[140px] bg-[#e8eaed] sm:col-span-3">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,#e8eaed_0%,#d2e3fc_50%,#e8eaed_100%)]" />
            <div className="absolute left-[38%] top-[42%]">
              <div className="h-8 w-8 -translate-x-1/2 -translate-y-full">
                <svg viewBox="0 0 24 24" className="h-8 w-8 drop-shadow-md" aria-hidden>
                  <path
                    fill="#ea4335"
                    d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
                  />
                </svg>
              </div>
            </div>
            {[1, 2, 3].map((rank, i) => (
              <div
                key={rank}
                className="absolute flex h-6 w-6 items-center justify-center rounded-full bg-[#1a73e8] text-[10px] font-bold text-white shadow-sm"
                style={{
                  left: `${28 + i * 18}%`,
                  top: `${30 + i * 12}%`,
                }}
              >
                {rank}
              </div>
            ))}
            <div className="absolute bottom-2 left-2 right-2 rounded-md bg-white/95 px-2 py-1.5 text-[10px] text-[#5f6368] shadow-sm">
              Map rankings · 1, 3, 5 mi radius
            </div>
          </div>
        </div>

        {/* Activity strip */}
        <div className="border-t border-[#dadce0] bg-[#f8f9fa] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#80868b]">
            Last update · Yesterday 2:14 AM
          </p>
          <ul className="mt-2 space-y-1 text-xs text-[#3c4043]">
            <li className="flex items-start gap-1.5">
              <span className="text-[#188038]">✓</span>
              Ranking increased for &ldquo;roof repair&rdquo;
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-[#188038]">✓</span>
              Score increased 4 points
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-[#1a73e8]">→</span>
              Next: Upload 8 exterior photos
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
