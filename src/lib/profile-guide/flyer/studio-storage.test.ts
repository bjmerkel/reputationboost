import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { appendFlyerHistoryEntry } from "./studio-db";
import { parseFlyerStudioState } from "./studio-storage";

const SAMPLE_IMAGE = "data:image/png;base64,abc123";

describe("flyer studio state", () => {
  it("parses persisted flyer studio state", () => {
    const restored = parseFlyerStudioState({
      version: 1,
      template: "professional",
      format: "letter",
      promptRefinement: "warmer tones",
      displayOptions: {
        showPhone: true,
        showStars: true,
        showAddress: false,
        showTagline: true,
      },
      preview: SAMPLE_IMAGE,
      studioCache: {
        backgroundDataUrl: "data:image/png;base64,background",
        imagePrompt: "Soft gradient backdrop",
        copy: {
          headline: "We'd love your feedback",
          subhead: "Share your experience on Google",
          cta: "Thank you!",
          qrLabel: "Scan to review",
          supportLine: "Plumber · Austin, TX",
        },
      },
      history: [
        {
          id: "entry-1",
          imageDataUrl: SAMPLE_IMAGE,
          label: "professional · Letter",
          template: "professional",
          format: "letter",
          createdAt: "2026-07-30T00:00:00.000Z",
        },
      ],
      selectedHistoryId: "entry-1",
      updatedAt: "2026-07-30T00:00:00.000Z",
    });

    assert.ok(restored);
    assert.equal(restored?.template, "professional");
    assert.equal(restored?.preview, SAMPLE_IMAGE);
    assert.equal(restored?.studioCache?.imagePrompt, "Soft gradient backdrop");
    assert.equal(restored?.history.length, 1);
  });

  it("returns null for invalid stored payloads", () => {
    assert.equal(parseFlyerStudioState({ version: 1, preview: "not-an-image" }), null);
  });
});

describe("appendFlyerHistoryEntry", () => {
  it("skips history updates for recompose-only saves", () => {
    const result = appendFlyerHistoryEntry({
      existing: {
        version: 1,
        template: "professional",
        format: "letter",
        promptRefinement: "",
        displayOptions: {
          showPhone: true,
          showStars: true,
          showAddress: false,
          showTagline: true,
        },
        preview: SAMPLE_IMAGE,
        studioCache: null,
        history: [],
        selectedHistoryId: null,
        updatedAt: "2026-07-30T00:00:00.000Z",
      },
      imageDataUrl: SAMPLE_IMAGE,
      template: "professional",
      format: "letter",
      recomposedOnly: true,
    });

    assert.equal(result.history.length, 0);
    assert.equal(result.selectedHistoryId, null);
  });

  it("prepends a new history entry for full generations", () => {
    const result = appendFlyerHistoryEntry({
      existing: null,
      imageDataUrl: SAMPLE_IMAGE,
      template: "friendly",
      format: "story",
      recomposedOnly: false,
    });

    assert.equal(result.history.length, 1);
    assert.equal(result.history[0]?.template, "friendly");
    assert.equal(result.history[0]?.format, "story");
    assert.equal(result.selectedHistoryId, result.history[0]?.id);
  });
});
