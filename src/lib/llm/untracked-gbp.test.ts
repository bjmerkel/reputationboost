import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { selectUntrackedGbpOpportunities } from "@/lib/llm/untracked-gbp";

describe("untracked-gbp llm selection", () => {
  it("falls back to impression-ranked heuristics when LLM is not configured", async () => {
    const result = await selectUntrackedGbpOpportunities({
      name: "Northshore Learning Center",
      industry: "Preschool",
      city: "Las Vegas",
      state: "NV",
      trackedKeywords: ["northshore learning center las vegas", "preschool summerlin", "daycare 89129"],
      gbpSearchTerms: [
        { keyword: "daycare near me", impressions: 90, belowThreshold: false },
        { keyword: "daycare las vegas", impressions: 40, belowThreshold: false },
        { keyword: "child care las vegas", impressions: null, belowThreshold: true },
      ],
      limit: 3,
    });

    assert.equal(result.source, "heuristic");
    assert.equal(result.opportunities.length, 3);
    assert.equal(result.opportunities[0]?.keyword, "daycare near me");
    assert.match(result.opportunities[0]?.reason ?? "", /90 impressions/i);
  });

  it("ranks below-threshold terms with high-volume Maps phrasing ahead of niche terms", async () => {
    const result = await selectUntrackedGbpOpportunities({
      name: "Northshore Learning Center",
      industry: "Preschool",
      city: "Las Vegas",
      state: "NV",
      trackedKeywords: ["northshore learning center las vegas"],
      gbpSearchTerms: [
        { keyword: "child care classes for grandparents las vegas nv", impressions: null, belowThreshold: true },
        { keyword: "preschool near me", impressions: null, belowThreshold: true },
        { keyword: "day care las vegas", impressions: null, belowThreshold: true },
      ],
      limit: 2,
    });

    assert.equal(result.source, "heuristic");
    assert.deepEqual(
      result.opportunities.map((item) => item.keyword),
      ["preschool near me", "day care las vegas"]
    );
    assert.match(result.opportunities[0]?.reason ?? "", /high-volume Maps query/i);
    assert.equal(result.opportunities[0]?.belowThreshold, true);
  });
});
