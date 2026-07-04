import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compareNap, napDriftGapId } from "./nap-drift";

describe("compareNap", () => {
  it("detects title and phone drift", () => {
    const drifts = compareNap(
      {
        name: "Dallas Pro Plumbing",
        phone: "(214) 555-0100",
        website: "https://example.com",
        address: "123 Main St, Dallas, TX",
      },
      {
        title: "Dallas Plumbing Pro",
        phone: "214-555-0199",
        website: "https://example.com",
        address: "123 Main St, Dallas, TX 75201",
      }
    );

    assert.ok(drifts.some((d) => d.field === "title"));
    assert.ok(drifts.some((d) => d.field === "phone"));
    assert.equal(napDriftGapId("title"), "nap-drift-title");
  });

  it("ignores matching phone formatting", () => {
    const drifts = compareNap(
      {
        name: "Acme",
        phone: "(214) 555-0100",
        website: "",
        address: "",
      },
      { title: "Acme", phone: "2145550100" }
    );
    assert.equal(drifts.length, 0);
  });
});
