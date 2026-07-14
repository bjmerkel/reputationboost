import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { storedPlaceGeometry } from "./place-geometry";

describe("storedPlaceGeometry", () => {
  it("returns stored coordinates without a Places Details request", () => {
    assert.deepEqual(
      storedPlaceGeometry({ lat: 30.2672, lng: -97.7431 }),
      { lat: 30.2672, lng: -97.7431 }
    );
  });

  it("rejects incomplete coordinates", () => {
    assert.equal(storedPlaceGeometry({ lat: 30.2672 }), null);
    assert.equal(storedPlaceGeometry({ lat: Number.NaN, lng: -97.7431 }), null);
  });
});
