import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getCachedPlacesSearch,
  placesSearchCacheKey,
  setCachedPlacesSearch,
} from "./places-cache";

describe("places-cache", () => {
  it("stores and returns cached Nearby Search results", () => {
    const key = placesSearchCacheKey("plumber", 32.7767, -96.797, 1609);
    const results = [
      {
        placeId: "abc",
        name: "Test Plumber",
        rating: 4.5,
        reviewCount: 10,
        address: "123 Main St",
        types: ["plumber"],
        position: 1,
      },
    ];

    assert.equal(getCachedPlacesSearch(key), null);
    setCachedPlacesSearch(key, results);
    assert.deepEqual(getCachedPlacesSearch(key), results);
  });

  it("normalizes keyword casing in cache keys", () => {
    const lower = placesSearchCacheKey("Plumber", 32.7767, -96.797, 1609);
    const upper = placesSearchCacheKey("PLUMBER", 32.7767, -96.797, 1609);
    assert.equal(lower, upper);
  });
});
