import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapPlaceResult } from "./places";

describe("Places search geometry", () => {
  it("preserves geometry returned by legacy Nearby and Text Search", () => {
    const result = mapPlaceResult(
      {
        place_id: "competitor-1",
        name: "Nearby Competitor",
        rating: 4.7,
        user_ratings_total: 125,
        vicinity: "2 Main St",
        types: ["plumber"],
        geometry: {
          location: {
            lat: 30.2672,
            lng: -97.7431,
          },
        },
      },
      2
    );

    assert.equal(result.position, 2);
    assert.equal(result.lat, 30.2672);
    assert.equal(result.lng, -97.7431);
  });
});
