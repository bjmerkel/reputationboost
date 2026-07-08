import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rankColor } from "@/components/platform/heatmap/rank-colors";

describe("rankColor", () => {
  it("uses dark red for page-one ranks (4–10)", () => {
    assert.equal(rankColor(7), "#c5221f");
  });
});
