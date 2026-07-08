export interface AttributionNarrativeHighlights {
  serviceAreaVisibility?: { before: number; after: number; delta: number };
  widerRadiusMiles?: number;
}

/** Extract structured service-area signals from attribution narrative text. */
export function parseAttributionNarrativeHighlights(
  narrative: string
): AttributionNarrativeHighlights {
  const highlights: AttributionNarrativeHighlights = {};

  const visMatch = narrative.match(/service-area visibility (\d+) → (\d+)/);
  if (visMatch) {
    const before = Number(visMatch[1]);
    const after = Number(visMatch[2]);
    highlights.serviceAreaVisibility = { before, after, delta: after - before };
  }

  const radiusMatch = narrative.match(/pack strengthened at (\d+) mi/);
  if (radiusMatch) {
    highlights.widerRadiusMiles = Number(radiusMatch[1]);
  }

  return highlights;
}
