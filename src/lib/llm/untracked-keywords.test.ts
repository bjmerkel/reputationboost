import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeKeywordPortfolio } from "@/audit/phase2/keyword-portfolio";
import { createTestAudit } from "@/audit/phase3/test-fixtures";
import { enrichUntrackedCandidatesWithLlm } from "./untracked-keywords";

describe("enrichUntrackedCandidatesWithLlm", () => {
  it("returns heuristic portfolio unchanged when LLM is not configured", async () => {
    const previous = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const audit = createTestAudit();
      audit.gbp.identity.primaryCategory = "Day care center";
      audit.gbp.identity.address = "7901 W Gowan Rd, Las Vegas, NV 89129";
      audit.gbp.performance.searchKeywords = [
        { keyword: "daycare near me", impressions: 90, belowThreshold: false },
        { keyword: "daycare las vegas", impressions: 40, belowThreshold: false },
        { keyword: "kiddie academy", impressions: 98, belowThreshold: false },
      ];
      const portfolio = computeKeywordPortfolio(audit);
      const enriched = await enrichUntrackedCandidatesWithLlm(audit, portfolio);
      assert.equal(enriched.untrackedLlmRanked, false);
      assert.equal(enriched.untrackedCandidates.length, portfolio.untrackedCandidates.length);
    } finally {
      if (previous == null) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previous;
    }
  });
});
