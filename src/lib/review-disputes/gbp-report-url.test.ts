import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGoogleLocalReviewsUrl,
  buildGoogleMapsReviewsDisputeUrl,
  buildGooglePlacesReviewsUri,
  buildStableGoogleMapsReviewsUrl,
  parseGoogleMapsPlaceUrl,
  stripEphemeralGoogleMapsParams,
} from "./gbp-report-url";

const WAYNE_REVIEWS_URL =
  "https://www.google.com/maps/place/Wayne+Refrigeration+Air+and+Heat/@40.073132,-74.724323,8z/data=!4m8!3m7!1s0x89c2fbb08fee3e05:0x507fa08fe1baa26f!8m2!3d40.073132!4d-74.724323!9m1!1b1!16s%2Fg%2F1tzgkl0l!5m1!1e2?entry=ttu&g_ep=EgoyMDI2MDcxMy4wIKXMDSoASAFQAw%3D%3D";

const WAYNE_OVERVIEW_URL =
  "https://www.google.com/maps/place/Wayne+Refrigeration+Air+and+Heat/@40.073132,-74.724323,8z/data=!3m1!4b1!4m6!3m5!1s0x89c2fbb08fee3e05:0x507fa08fe1baa26f!8m2!3d40.073132!4d-74.724323!16s%2Fg%2F1tzgkl0l!5m1!1e2?entry=ttu";

const CID_ONLY_URL = "https://www.google.com/maps?cid=5800531384904360559";
const WAYNE_CID_HEX = "0x89c2fbb08fee3e05:0x507fa08fe1baa26f";

test("stripEphemeralGoogleMapsParams removes tracking query params", () => {
  const cleaned = stripEphemeralGoogleMapsParams(WAYNE_REVIEWS_URL);
  assert.ok(!cleaned.includes("entry=ttu"));
  assert.ok(!cleaned.includes("g_ep="));
  assert.ok(cleaned.includes("Wayne+Refrigeration"));
});

test("parseGoogleMapsPlaceUrl extracts stable identifiers", () => {
  const parsed = parseGoogleMapsPlaceUrl(WAYNE_REVIEWS_URL);
  assert.equal(parsed?.name, "Wayne Refrigeration Air and Heat");
  assert.equal(parsed?.lat, 40.073132);
  assert.equal(parsed?.lng, -74.724323);
  assert.equal(parsed?.cidHex, WAYNE_CID_HEX);
  assert.equal(parsed?.kgMid, "/g/1tzgkl0l");
});

test("parseGoogleMapsPlaceUrl extracts identifiers from overview URLs", () => {
  const parsed = parseGoogleMapsPlaceUrl(WAYNE_OVERVIEW_URL);
  assert.equal(parsed?.cidHex, WAYNE_CID_HEX);
  assert.equal(parsed?.lat, 40.073132);
  assert.equal(parsed?.lng, -74.724323);
});

test("parseGoogleMapsPlaceUrl reads decimal cid links", () => {
  const parsed = parseGoogleMapsPlaceUrl(CID_ONLY_URL);
  assert.equal(parsed?.cidDecimal, "5800531384904360559");
  assert.equal(parsed?.lat, undefined);
});

test("buildGooglePlacesReviewsUri uses official Places API reviews format", () => {
  const url = buildGooglePlacesReviewsUri(WAYNE_CID_HEX);
  assert.equal(
    url,
    "https://www.google.com/maps/place//data=!4m4!3m3!1s0x89c2fbb08fee3e05:0x507fa08fe1baa26f!9m1!1b1"
  );
});

test("buildGoogleLocalReviewsUrl opens search.google.com reviews panel", () => {
  const url = buildGoogleLocalReviewsUrl("ChIJ123", "Wayne Refrigeration Air and Heat");
  assert.equal(
    url,
    "https://search.google.com/local/reviews?placeid=ChIJ123&q=Wayne+Refrigeration+Air+and+Heat"
  );
});

test("buildStableGoogleMapsReviewsUrl prefers official reviews URI when cid hex is known", () => {
  const parsed = parseGoogleMapsPlaceUrl(WAYNE_REVIEWS_URL)!;
  const url = buildStableGoogleMapsReviewsUrl({
    ...parsed,
    name: parsed.name!,
  })!;

  assert.equal(url, buildGooglePlacesReviewsUri(WAYNE_CID_HEX));
});

test("buildGoogleMapsReviewsDisputeUrl upgrades overview URLs to official reviews URI", () => {
  const url = buildGoogleMapsReviewsDisputeUrl({
    name: "Wayne Refrigeration Air and Heat",
    mapsUrl: WAYNE_OVERVIEW_URL,
  });

  assert.equal(url, buildGooglePlacesReviewsUri(WAYNE_CID_HEX));
  assert.ok(!url.includes("!3m1!4b1"));
  assert.ok(!url.includes("entry="));
});

test("buildGoogleMapsReviewsDisputeUrl upgrades cid-only URLs with business coordinates", () => {
  const url = buildGoogleMapsReviewsDisputeUrl({
    name: "Wayne Refrigeration Air and Heat",
    address: "123 Main St, NJ",
    mapsUrl: CID_ONLY_URL,
    lat: 40.073132,
    lng: -74.724323,
  });

  assert.ok(url.includes("/maps/place/Wayne+Refrigeration"));
  assert.ok(url.includes("!9m1!1b1"));
  assert.ok(url.includes("@40.073132,-74.724323"));
  assert.ok(url.includes("?cid=5800531384904360559"));
  assert.ok(!url.match(/^https:\/\/www\.google\.com\/maps\?cid=/));
});

test("buildGoogleMapsReviewsDisputeUrl prefers place id local reviews link", () => {
  const url = buildGoogleMapsReviewsDisputeUrl({
    name: "Test Business",
    placeId: "ChIJ123",
    mapsUrl: WAYNE_OVERVIEW_URL,
  });
  assert.equal(url, buildGoogleLocalReviewsUrl("ChIJ123", "Test Business"));
  assert.ok(url.startsWith("https://search.google.com/local/reviews"));
});

test("buildGoogleMapsReviewsDisputeUrl uses per-business maps URL when complete", () => {
  const url = buildGoogleMapsReviewsDisputeUrl({
    name: "Wayne Refrigeration Air and Heat",
    address: "123 Main St",
    mapsUrl: WAYNE_REVIEWS_URL,
  });

  assert.equal(url, buildGooglePlacesReviewsUri(WAYNE_CID_HEX));
});

test("buildStableGoogleMapsReviewsUrl does not return bare cid when coords are missing", () => {
  assert.equal(
    buildStableGoogleMapsReviewsUrl({
      name: "Wayne Refrigeration Air and Heat",
      cidDecimal: "5800531384904360559",
    }),
    null
  );
});
