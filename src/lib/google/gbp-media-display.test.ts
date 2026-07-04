import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GbpMediaPreview } from "@/audit/types";
import {
  formatCustomerAttribution,
  selectPreferredHeroPreview,
} from "./gbp-media-display";

function preview(
  overrides: Partial<GbpMediaPreview> & Pick<GbpMediaPreview, "thumbnailUrl">
): GbpMediaPreview {
  return {
    googleUrl: overrides.thumbnailUrl,
    mediaFormat: "PHOTO",
    category: null,
    ...overrides,
  };
}

describe("selectPreferredHeroPreview", () => {
  it("prefers owner exterior photos over customer uploads", () => {
    const selected = selectPreferredHeroPreview([
      preview({
        thumbnailUrl: "https://example.com/customer.jpg",
        isCustomerPhoto: true,
        attributionName: "Jane",
      }),
      preview({
        thumbnailUrl: "https://example.com/exterior.jpg",
        category: "EXTERIOR",
      }),
    ]);

    assert.equal(selected?.thumbnailUrl, "https://example.com/exterior.jpg");
  });

  it("falls back to customer photo when no owner photos exist", () => {
    const selected = selectPreferredHeroPreview([
      preview({
        thumbnailUrl: "https://example.com/customer.jpg",
        isCustomerPhoto: true,
      }),
    ]);

    assert.equal(selected?.thumbnailUrl, "https://example.com/customer.jpg");
  });
});

describe("formatCustomerAttribution", () => {
  it("uses profile name when available", () => {
    assert.equal(formatCustomerAttribution("Jane Doe"), "Jane Doe");
  });

  it("falls back to Customer label", () => {
    assert.equal(formatCustomerAttribution(), "Customer");
  });
});
