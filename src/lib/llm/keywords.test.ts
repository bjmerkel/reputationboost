import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { suggestKeywords } from "./keywords";

describe("suggestKeywords portfolio mode", () => {
  it("returns template replacements that avoid the current keyword set", async () => {
    const result = await suggestKeywords({
      name: "Wayne Refrigeration",
      industry: "HVAC contractor",
      city: "Wayne",
      state: "NJ",
      existingKeywords: ["hvac installation ridgewood nj", "emergency ac repair ridgewood"],
      replaceKeyword: "emergency ac repair ridgewood",
      gbpSearchTerms: ["hvac company wayne", "wayne, nj"],
    });

    assert.ok(result.keywords.length >= 2);
    assert.ok(
      result.keywords.every((item) => item.keyword !== "emergency ac repair ridgewood")
    );
    assert.ok(result.source === "template" || result.source === "llm");
  });
});
