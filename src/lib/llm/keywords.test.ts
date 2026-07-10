import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { suggestKeywords } from "./keywords";

describe("suggestKeywords portfolio mode", () => {
  it("returns non-empty template replacements that avoid the current keyword set", async () => {
    const existing = [
      "hvac installation ridgewood nj",
      "emergency ac repair ridgewood",
      "air conditioning service ridgewood",
    ];
    const result = await suggestKeywords({
      name: "Wayne Refrigeration",
      industry: "HVAC contractor",
      city: "Wayne",
      state: "NJ",
      existingKeywords: existing,
      replaceKeyword: "emergency ac repair ridgewood",
      gbpSearchTerms: ["hvac company wayne", "furnace repair wayne"],
    });

    assert.ok(result.keywords.length >= 1, "expected at least one suggestion");
    const blocked = new Set(
      existing.filter((k) => k !== "emergency ac repair ridgewood")
    );
    for (const item of result.keywords) {
      assert.notEqual(item.keyword, "emergency ac repair ridgewood");
      assert.equal(blocked.has(item.keyword), false, `should not suggest tracked "${item.keyword}"`);
    }
    assert.equal(typeof result.llmConfigured, "boolean");
    assert.ok(result.source === "template" || result.source === "llm");
  });

  it("reports when LLM is not configured", async () => {
    const previous = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const result = await suggestKeywords({
        name: "Dallas Pro Plumbing",
        industry: "Plumber",
        city: "Dallas",
        state: "TX",
        existingKeywords: ["plumber dallas", "emergency plumber dallas", "plumber near me"],
        replaceKeyword: "plumber near me",
      });
      assert.equal(result.llmConfigured, false);
      assert.equal(result.source, "template");
      assert.ok(result.keywords.length >= 1);
      assert.match(result.warning ?? "", /OPENAI_API_KEY/i);
    } finally {
      if (previous == null) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previous;
    }
  });
});
