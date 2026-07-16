import assert from "node:assert/strict";
import test from "node:test";
import { formatStarRating } from "./format-star-rating";

test("formatStarRating rounds to two decimal places", () => {
  assert.equal(formatStarRating(4.300000190734863), "4.30");
  assert.equal(formatStarRating(4.6), "4.60");
  assert.equal(formatStarRating(5), "5.00");
});
