import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGoogleMapsReviewsDisputeUrl,
  buildStableGoogleMapsReviewsUrl,
  parseGoogleMapsPlaceUrl,
  stripEphemeralGoogleMapsParams,
} from "./gbp-report-url";

const WAYNE_URL =
  "https://www.google.com/maps/place/Wayne+Refrigeration+Air+and+Heat/@40.073132,-74.724323,8z/data=!4m8!3m7!1s0x89c2fbb08fee3e05:0x507fa08fe1baa26f!8m2!3d40.073132!4d-74.724323!9m1!1b1!16s%2Fg%2F1tzgkl0l!5m1!1e2?entry=ttu&g_ep=EgoyMDI2MDcxMy4wIKXMDSoASAFQAw%3D%3D";

test("stripEphemeralGoogleMapsParams removes tracking query params", () => {
  const cleaned = stripEphemeralGoogleMapsParams(WAYNE_URL);
  assert.ok(!cleaned.includes("entry=ttu"));
  assert.ok(!cleaned.includes("g_ep="));
  assert.ok(cleaned.includes("Wayne+Refrigeration"));
});

test("parseGoogleMapsPlaceUrl extracts stable identifiers", () => {
  const parsed = parseGoogleMapsPlaceUrl(WAYNE_URL);
  assert.equal(parsed?.name, "Wayne Refrigeration Air and Heat");
  assert.equal(parsed?.lat, 40.073132);
  assert.equal(parsed?.lng, -74.724323);
  assert.equal(parsed?.cidHex, "0x89c2fbb08fee3e05:0x507fa08fe1baa26f");
  assert.equal(parsed?.kgMid, "/g/1tzgkl0l");
});

test("buildStableGoogleMapsReviewsUrl rebuilds reviews-focused link", () => {
  const parsed = parseGoogleMapsPlaceUrl(WAYNE_URL)!;
  const url = buildStableGoogleMapsReviewsUrl({
    ...parsed,
    name: parsed.name!,
    zoom: 17,
  })!;

  assert.ok(url.startsWith("https://www.google.com/maps/place/Wayne+Refrigeration"));
  assert.ok(url.includes("!9m1!1b1"));
  assert.ok(url.includes("!1s0x89c2fbb08fee3e05:0x507fa08fe1baa26f"));
  assert.ok(url.includes("!16s%2Fg%2F1tzgkl0l"));
  assert.ok(!url.includes("entry="));
  assert.ok(!url.includes("g_ep="));
});

test("buildGoogleMapsReviewsDisputeUrl uses per-business maps URL", () => {
  const url = buildGoogleMapsReviewsDisputeUrl({
    name: "Wayne Refrigeration Air and Heat",
    address: "123 Main St",
    mapsUrl: WAYNE_URL,
  });

  assert.ok(url.includes("!9m1!1b1"));
  assert.ok(url.includes("Wayne+Refrigeration"));
  assert.ok(!url.includes("g_ep="));
});

test("buildGoogleMapsReviewsDisputeUrl falls back to place id", () => {
  const url = buildGoogleMapsReviewsDisputeUrl({
    name: "Test Business",
    placeId: "ChIJ123",
  });
  assert.ok(url.includes("query_place_id=ChIJ123"));
});
