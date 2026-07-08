import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildBusinessAddress,
  detectServiceAreaBusiness,
  parseCityStateFromAreaText,
  resolveServiceAreaLabel,
  stripServesPrefix,
} from "./parse-business-place";

describe("parse-business-place", () => {
  it("parses Ridgewood, NJ from service-area text", () => {
    assert.deepEqual(parseCityStateFromAreaText("Ridgewood, NJ"), {
      city: "Ridgewood",
      state: "NJ",
      zip: "",
    });
  });

  it("parses city, state, and zip", () => {
    assert.deepEqual(parseCityStateFromAreaText("Serves Dallas, TX 75201"), {
      city: "Dallas",
      state: "TX",
      zip: "75201",
    });
  });

  it("prefers short formatted address for service-area label", () => {
    assert.equal(
      resolveServiceAreaLabel("", "Ridgewood, NJ", "Wayne, NJ"),
      "Ridgewood, NJ"
    );
  });

  it("strips Serves prefix", () => {
    assert.equal(stripServesPrefix("Serves Ridgewood, NJ"), "Ridgewood, NJ");
  });

  it("detects service-area businesses from Google flag", () => {
    assert.equal(
      detectServiceAreaBusiness({
        isPureServiceAreaBusiness: true,
        hasStreet: false,
        serviceAreaLabel: "Ridgewood, NJ",
      }),
      true
    );
  });

  it("uses service-area label for address when no street", () => {
    assert.equal(
      buildBusinessAddress({
        street: "",
        formattedAddress: "",
        serviceAreaLabel: "Ridgewood, NJ",
        isServiceAreaBusiness: true,
      }),
      "Ridgewood, NJ"
    );
  });
});
