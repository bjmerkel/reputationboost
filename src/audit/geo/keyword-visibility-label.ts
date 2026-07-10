import type { KeywordRankSnapshot } from "@/audit/types";
import { RADIAL_RING_MILES } from "@/lib/google/radial-rankings";

export type KeywordVisibilityTone = "good" | "warning" | "weak";

export interface KeywordVisibilityLabel {
  text: string;
  title: string;
  tone: KeywordVisibilityTone;
}

export function radialCoverageDropDistance(kw: KeywordRankSnapshot): number | null {
  if (kw.rankingModel !== "radial_text_v2" || !kw.inLocalPack) return null;

  for (const miles of RADIAL_RING_MILES) {
    const ring = kw.geoRanks.find((point) => point.distanceMiles === miles);
    if (
      ring?.sampleCount &&
      (ring.inLocalPackCount ?? 0) / ring.sampleCount < 0.5
    ) {
      return miles;
    }
  }

  return null;
}

/** Coverage-first dropdown label; avoids presenting the business-pin rank as area-wide rank. */
export function keywordVisibilityLabel(
  kw: KeywordRankSnapshot
): KeywordVisibilityLabel {
  if (kw.rankingModel === "radial_text_v2") {
    const rings = kw.geoRanks.filter((ring) => (ring.sampleCount ?? 0) > 0);
    const samples = rings.reduce((sum, ring) => sum + (ring.sampleCount ?? 0), 0);
    const top3 = rings.reduce(
      (sum, ring) => sum + (ring.inLocalPackCount ?? 0),
      0
    );
    const dropDistance = radialCoverageDropDistance(kw);

    if (samples > 0) {
      const coverage = `${top3}/${samples} samples top 3`;
      return {
        text:
          dropDistance == null
            ? coverage
            : `${coverage} · drops at ${dropDistance} mi`,
        title: `${coverage}. ${
          dropDistance == null
            ? "No majority-coverage drop across the measured rings."
            : `Top-three coverage falls below half of samples at ${dropDistance} miles.`
        }`,
        tone: top3 === 0 ? "weak" : dropDistance == null ? "good" : "warning",
      };
    }
  }

  const legacyRank =
    kw.geoRanks.find((point) => point.distanceMiles === 1)?.rank ??
    (typeof kw.localPackPosition === "number" ? kw.localPackPosition : null);
  if (legacyRank != null) {
    return {
      text: `#${legacyRank} at pin · legacy`,
      title: "Legacy API rank measured from the business pin.",
      tone: legacyRank <= 3 ? "good" : "weak",
    };
  }

  return {
    text: "Legacy: not visible",
    title: "The business was not found in the legacy API result set.",
    tone: "weak",
  };
}
