import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { businessMentionedInText, findBusinessPosition } from "./mention-extractor";
import { buildAiQueryVariants } from "./query-variants";
import { buildAiVisibilitySnapshot } from "./scoring";
import type { AiProbeResult } from "@/audit/types/ai-visibility";

describe("ai-visibility mention-extractor", () => {
  it("detects exact and partial business name mentions", () => {
    assert.equal(
      businessMentionedInText("Dallas Pro Plumbing", "Try Dallas Pro Plumbing for emergency service."),
      true
    );
    assert.equal(
      businessMentionedInText("Dallas Pro Plumbing", "Austin Pro Plumbing is a top pick."),
      false
    );
  });

  it("finds business position among named competitors", () => {
    const position = findBusinessPosition("Dallas Pro Plumbing", [
      { name: "Austin Pro Plumbing", position: 1 },
      { name: "Dallas Pro Plumbing", position: 2 },
    ]);
    assert.equal(position, 2);
  });
});

describe("ai-visibility query variants", () => {
  it("builds near-me and city variants", () => {
    const variants = buildAiQueryVariants("emergency plumber", "Austin", "TX");
    assert.equal(variants.length, 2);
    assert.match(variants[0], /best emergency plumber near me/i);
  });
});

describe("ai-visibility scoring", () => {
  it("scores mention and recommendation rates", () => {
    const probes: AiProbeResult[] = [
      {
        surface: "chatgpt",
        keyword: "plumber",
        queryText: "best plumber near me",
        mentioned: true,
        recommended: true,
        position: 2,
        competitorsNamed: [{ name: "A", position: 1 }, { name: "Target Co", position: 2 }],
        citations: [{ domain: "google.com" }],
        answerExcerpt: "Target Co is a strong option.",
        rawResponseHash: "abc",
      },
      {
        surface: "google_ai_overview",
        keyword: "plumber",
        queryText: "who should I call for plumber in Austin, TX",
        mentioned: false,
        recommended: false,
        position: null,
        competitorsNamed: [{ name: "A", position: 1 }],
        citations: [],
        answerExcerpt: "A is recommended.",
        rawResponseHash: "def",
      },
    ];

    const snapshot = buildAiVisibilitySnapshot(probes, ["plumber"], "demo");
    assert.equal(snapshot.totalKeywords, 1);
    assert.equal(snapshot.keywords[0].score > 0, true);
    assert.equal(snapshot.keywords[0].mentionRate, 0.5);
  });
});
