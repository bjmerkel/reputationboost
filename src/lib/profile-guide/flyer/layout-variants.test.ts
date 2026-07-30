import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getArchetypeLayoutTokens } from "./layout-variants";

describe("getArchetypeLayoutTokens", () => {
  it("returns industrial-modern tokens with diagonal accent and branded QR ring", () => {
    const tokens = getArchetypeLayoutTokens("industrial-modern");
    assert.equal(tokens.accentBarStyle, "diagonal");
    assert.equal(tokens.qrFrame, "branded-ring");
    assert.equal(tokens.headlineWeight, 900);
  });

  it("returns clinical-luxury tokens with glass panel and minimal hero", () => {
    const tokens = getArchetypeLayoutTokens("clinical-luxury");
    assert.equal(tokens.cardStyle, "glass-panel");
    assert.equal(tokens.coverTreatment, "minimal-hero");
  });

  it("falls back to local-trust defaults for unknown archetypes", () => {
    const tokens = getArchetypeLayoutTokens(null);
    assert.equal(tokens.qrFrame, "rounded-card");
    assert.equal(tokens.accentBarStyle, "none");
  });
});
