import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isHighVolumeMapsKeyword, suggestKeywords } from "./keywords";

const wayne = {
  name: "Wayne Refrigeration",
  industry: "HVAC contractor",
  city: "Wayne",
  state: "NJ",
};

describe("isHighVolumeMapsKeyword", () => {
  it("accepts common Maps-style service + geo queries", () => {
    assert.equal(isHighVolumeMapsKeyword("hvac wayne", wayne), true);
    assert.equal(isHighVolumeMapsKeyword("hvac near me", wayne), true);
    assert.equal(isHighVolumeMapsKeyword("best hvac wayne", wayne), true);
    assert.equal(isHighVolumeMapsKeyword("hvac repair wayne", wayne), true);
    assert.equal(isHighVolumeMapsKeyword("hvac wayne nj", wayne), true);
  });

  it("rejects low-volume research and junk phrasing", () => {
    assert.equal(isHighVolumeMapsKeyword("cost to replace hvac system nj", wayne), false);
    assert.equal(isHighVolumeMapsKeyword("hvac installation quotes wayne", wayne), false);
    assert.equal(isHighVolumeMapsKeyword("how to fix furnace diy", wayne), false);
    assert.equal(isHighVolumeMapsKeyword("hvac salary nj", wayne), false);
    assert.equal(isHighVolumeMapsKeyword("wayne", wayne), false);
    assert.equal(isHighVolumeMapsKeyword("wayne nj", wayne), false);
    assert.equal(
      isHighVolumeMapsKeyword("495 river street hvac and roof replacement", wayne),
      false
    );
  });

  it("rejects brand-only navigational queries without service intent", () => {
    assert.equal(isHighVolumeMapsKeyword("wayne refrigeration", wayne), false);
  });
});

describe("suggestKeywords portfolio mode", () => {
  it("returns non-empty high-volume replacements that avoid the current keyword set", async () => {
    const existing = [
      "hvac installation ridgewood nj",
      "emergency ac repair ridgewood",
      "air conditioning service ridgewood",
    ];
    const result = await suggestKeywords({
      ...wayne,
      existingKeywords: existing,
      replaceKeyword: "emergency ac repair ridgewood",
      gbpSearchTerms: ["hvac company wayne", "furnace repair wayne", "cost to replace hvac system nj"],
    });

    assert.ok(result.keywords.length >= 1, "expected at least one suggestion");
    const blocked = new Set(existing.filter((k) => k !== "emergency ac repair ridgewood"));
    for (const item of result.keywords) {
      assert.notEqual(item.keyword, "emergency ac repair ridgewood");
      assert.equal(blocked.has(item.keyword), false, `should not suggest tracked "${item.keyword}"`);
      assert.equal(
        isHighVolumeMapsKeyword(item.keyword, wayne),
        true,
        `expected high-volume Maps keyword, got "${item.keyword}"`
      );
      assert.equal(
        /\b(cost|quote|how to|diy|salary)\b/i.test(item.keyword),
        false,
        `low-volume phrase leaked through: "${item.keyword}"`
      );
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
      for (const item of result.keywords) {
        assert.equal(
          isHighVolumeMapsKeyword(item.keyword, {
            name: "Dallas Pro Plumbing",
            industry: "Plumber",
            city: "Dallas",
            state: "TX",
          }),
          true
        );
      }
    } finally {
      if (previous == null) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previous;
    }
  });
});
