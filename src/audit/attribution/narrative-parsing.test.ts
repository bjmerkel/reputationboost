import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseAttributionNarrativeHighlights } from "./narrative-parsing";

describe("parseAttributionNarrativeHighlights", () => {
  it("extracts service-area visibility and wider-radius pack gains", () => {
    const highlights = parseAttributionNarrativeHighlights(
      "Post published Jul 3 → 'plumber near me' holding at #3 → service-area visibility 42 → 55 (+13 pts) → pack strengthened at 3 mi on 'plumber near me'"
    );

    assert.equal(highlights.serviceAreaVisibility?.before, 42);
    assert.equal(highlights.serviceAreaVisibility?.after, 55);
    assert.equal(highlights.serviceAreaVisibility?.delta, 13);
    assert.equal(highlights.widerRadiusMiles, 3);
  });
});
