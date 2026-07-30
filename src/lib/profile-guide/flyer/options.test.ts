import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyPromptRefinement, bufferToDataUrl, dataUrlToBuffer } from "./helpers";
import { buildFlyerFooter, parseFlyerDisplayOptions } from "./options";

describe("parseFlyerDisplayOptions", () => {
  it("defaults missing values to enabled except address", () => {
    assert.deepEqual(parseFlyerDisplayOptions(undefined), {
      showPhone: true,
      showStars: true,
      showAddress: false,
      showTagline: true,
    });
  });

  it("respects explicit false values", () => {
    assert.deepEqual(
      parseFlyerDisplayOptions({ showPhone: false, showStars: false, showAddress: true }),
      {
        showPhone: false,
        showStars: false,
        showAddress: true,
        showTagline: true,
      }
    );
  });
});

describe("buildFlyerFooter", () => {
  it("joins phone and address when enabled", () => {
    const footer = buildFlyerFooter(
      {
        phone: "(512) 555-0100",
        website: "https://acme.example",
        address: "1 Main St, Austin, TX",
        publicUrl: "https://example.com/g/acme",
      },
      { showPhone: true, showStars: true, showAddress: true, showTagline: true }
    );

    assert.equal(footer, "(512) 555-0100 · 1 Main St, Austin, TX");
  });
});

describe("prompt refinement helpers", () => {
  it("appends refinement text to the base prompt", () => {
    assert.match(
      applyPromptRefinement("Base prompt", "warmer tones"),
      /warmer tones/
    );
  });

  it("round-trips buffers through data URLs", () => {
    const original = Buffer.from("flyer-test");
    const dataUrl = bufferToDataUrl(original);
    const restored = dataUrlToBuffer(dataUrl);
    assert.equal(restored.toString(), "flyer-test");
  });
});
