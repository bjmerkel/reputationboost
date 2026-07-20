import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveAcvCopy, resolveAcvUnitKind } from "./acv-copy";

describe("resolveAcvUnitKind", () => {
  it("uses job language for home-service categories", () => {
    assert.equal(resolveAcvUnitKind("HVAC contractor"), "job");
    assert.equal(resolveAcvUnitKind("Plumber"), "job");
    assert.equal(resolveAcvUnitKind("Freedom Pool Services"), "job");
  });

  it("uses visit language for grooming and personal care", () => {
    assert.equal(resolveAcvUnitKind("Dog groomer"), "visit");
    assert.equal(resolveAcvUnitKind("Hair salon"), "visit");
  });

  it("uses sale language for dealers and retail", () => {
    assert.equal(resolveAcvUnitKind("Car dealer"), "sale");
    assert.equal(resolveAcvUnitKind("Retail store"), "sale");
  });

  it("uses order language for restaurants", () => {
    assert.equal(resolveAcvUnitKind("Restaurant"), "order");
  });

  it("falls back to customer language for unknown categories", () => {
    assert.equal(resolveAcvUnitKind("Consulting"), "customer");
  });
});

describe("resolveAcvCopy", () => {
  it("returns category-appropriate labels", () => {
    const grooming = resolveAcvCopy("Dog grooming");
    assert.equal(grooming.kind, "visit");
    assert.match(grooming.planNudgeTitle, /visit value/i);

    const dealer = resolveAcvCopy("Car dealer");
    assert.equal(dealer.kind, "sale");
    assert.match(dealer.fieldLabel, /sale value/i);
  });
});
