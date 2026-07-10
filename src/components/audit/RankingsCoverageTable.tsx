import type { GeoRankPoint, KeywordRankSnapshot } from "@/audit/types";
import { RADIAL_RING_MILES } from "@/lib/google/radial-rankings";

function rankLabel(rank: number | null | undefined): string {
  return rank == null ? "20+" : `#${rank}`;
}

function ringFor(kw: KeywordRankSnapshot, miles: number): GeoRankPoint | undefined {
  return kw.geoRanks.find((point) => point.distanceMiles === miles);
}

function coverageDropDistance(kw: KeywordRankSnapshot): number | null {
  if (kw.rankingModel !== "radial_text_v2" || !kw.inLocalPack) return null;
  for (const miles of RADIAL_RING_MILES) {
    const ring = ringFor(kw, miles);
    if (ring?.sampleCount && (ring.inLocalPackCount ?? 0) / ring.sampleCount < 0.5) {
      return miles;
    }
  }
  return null;
}

function RingResult({
  point,
  radial,
  light,
}: {
  point?: GeoRankPoint;
  radial: boolean;
  light: boolean;
}) {
  if (!point) return <span className={light ? "text-[#80868b]" : "text-slate-500"}>—</span>;

  if (!radial) {
    return (
      <span className={point.inLocalPack ? (light ? "text-[#137333]" : "text-emerald-400") : ""}>
        {point.rank == null ? "—" : `#${point.rank}`}
      </span>
    );
  }

  const samples = point.sampleCount ?? 0;
  const top3 = point.inLocalPackCount ?? 0;
  const visible = point.visibleCount ?? 0;
  return (
    <div>
      <div
        className={`font-semibold ${
          top3 >= Math.ceil(samples / 2)
            ? light
              ? "text-[#137333]"
              : "text-emerald-400"
            : light
              ? "text-[#c5221f]"
              : "text-red-400"
        }`}
      >
        Median {rankLabel(point.rank)}
      </div>
      <div className={`mt-0.5 text-[11px] ${light ? "text-[#5f6368]" : "text-slate-400"}`}>
        Top 3: {top3}/{samples} · Visible: {visible}/{samples}
      </div>
    </div>
  );
}

export default function RankingsCoverageTable({
  keywords,
  light,
}: {
  keywords: KeywordRankSnapshot[];
  light: boolean;
}) {
  const radialCount = keywords.filter((kw) => kw.rankingModel === "radial_text_v2").length;
  const hasRadial = radialCount > 0;
  const hasLegacy = radialCount < keywords.length;
  const distances = hasLegacy ? [1, 3, 5, 10] : [...RADIAL_RING_MILES];

  return (
    <div className="space-y-3">
      <p className={`text-sm ${light ? "text-[#5f6368]" : "text-slate-400"}`}>
        {hasRadial && !hasLegacy ? (
          <>
            Rankings are estimated with Google Places Text Search at the business pin and eight
            sampled locations at each distance. <strong>Top 3</strong> shows geographic coverage,
            not a guaranteed personalized Google Maps position. Open <strong>Rank samples</strong>{" "}
            on the map to inspect every measured location.
          </>
        ) : hasLegacy && !hasRadial ? (
          <>
            These are legacy Places API results collected with expanding search radii from the
            business pin. Run a fresh audit to generate location-based radial samples.
          </>
        ) : (
          <>
            This audit contains both new sampled rows and legacy business-pin radius rows. Each
            keyword is labeled below; run a fresh audit to finish upgrading all keywords.
          </>
        )}
      </p>
      <div
        className={`overflow-x-auto rounded-xl border ${
          light ? "border-[#dadce0] bg-white" : "border-white/8"
        }`}
      >
        <table className="w-full min-w-[54rem] text-left text-sm">
          <thead>
            <tr
              className={`border-b text-xs uppercase tracking-wider ${
                light
                  ? "border-[#dadce0] bg-[#f8f9fa] text-[#5f6368]"
                  : "border-white/10 bg-white/[0.02] text-slate-400"
              }`}
            >
              <th className="px-4 py-3">Keyword</th>
              <th className="px-4 py-3">At business</th>
              {distances.map((miles) => (
                <th key={miles} className="px-4 py-3">
                  {miles} mi
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {keywords.map((kw) => {
              const radial = kw.rankingModel === "radial_text_v2";
              const dropDistance = coverageDropDistance(kw);
              const centerRank = radial
                ? kw.centerRank
                : typeof kw.localPackPosition === "number"
                  ? kw.localPackPosition
                  : null;

              return (
                <tr
                  key={kw.keyword}
                  className={`border-b ${light ? "border-[#f1f3f4]" : "border-white/5"}`}
                >
                  <td className={`px-4 py-3 ${light ? "text-[#202124]" : "text-white"}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{kw.keyword}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] ${
                          radial
                            ? light
                              ? "bg-[#e8f0fe] text-[#1967d2]"
                              : "bg-blue-500/20 text-blue-300"
                            : light
                              ? "bg-[#f1f3f4] text-[#5f6368]"
                              : "bg-white/10 text-slate-300"
                        }`}
                      >
                        {radial ? "8-point rings" : "Legacy radius"}
                      </span>
                      {dropDistance != null && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            light
                              ? "bg-[#fef7e0] text-[#b06000]"
                              : "bg-amber-500/20 text-amber-300"
                          }`}
                        >
                          Coverage drops at {dropDistance} mi
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div
                      className={`font-semibold ${
                        centerRank != null && centerRank <= 3
                          ? light
                            ? "text-[#137333]"
                            : "text-emerald-400"
                          : light
                            ? "text-[#c5221f]"
                            : "text-red-400"
                      }`}
                    >
                      {rankLabel(centerRank)}
                    </div>
                    <div
                      className={`mt-0.5 text-[11px] ${light ? "text-[#5f6368]" : "text-slate-400"}`}
                    >
                      {radial ? "Text Search estimate" : "Legacy API result"}
                    </div>
                  </td>
                  {distances.map((miles) => (
                    <td key={miles} className="px-4 py-3">
                      <RingResult point={ringFor(kw, miles)} radial={radial} light={light} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
