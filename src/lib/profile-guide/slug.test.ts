import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allProfileGuideSlugCandidates,
  buildProfileGuideSlug,
  hasLegacyProfileGuideSlug,
  profileGuideSlugCandidates,
  profileGuideSlugWithoutLegacySuffix,
  slugifyProfileGuideName,
} from "./slug";

describe("slugifyProfileGuideName", () => {
  it("slugifies business names", () => {
    assert.equal(slugifyProfileGuideName("Joe's Plumbing"), "joe-s-plumbing");
    assert.equal(slugifyProfileGuideName("  Northshore Learning Center "), "northshore-learning-center");
  });
});

describe("profileGuideSlugCandidates", () => {
  it("starts with the base slug", () => {
    assert.deepEqual(profileGuideSlugCandidates("Northshore Learning Center"), [
      "northshore-learning-center",
      "northshorelearningcenter",
      "northshorelearning-center",
      "northshore-learningcenter",
    ]);
  });

  it("handles single-word names", () => {
    assert.deepEqual(profileGuideSlugCandidates("Acme"), ["acme"]);
  });

  it("adds numeric fallbacks after hyphen variants", () => {
    const candidates = allProfileGuideSlugCandidates("Acme Co");
    assert.equal(candidates[0], "acme-co");
    assert.equal(candidates[1], "acmeco");
    assert.equal(candidates[2], "acme-co-2");
  });
});

describe("buildProfileGuideSlug", () => {
  it("uses the business name without an id suffix", () => {
    assert.equal(buildProfileGuideSlug("Joe's Plumbing"), "joe-s-plumbing");
    assert.equal(
      buildProfileGuideSlug("Northshore Learning Center"),
      "northshore-learning-center"
    );
  });
});

describe("legacy profile guide slugs", () => {
  it("detects and strips legacy id suffixes", () => {
    assert.equal(
      hasLegacyProfileGuideSlug("northshore-learning-center-ffaea8e3"),
      true
    );
    assert.equal(
      profileGuideSlugWithoutLegacySuffix("northshore-learning-center-ffaea8e3"),
      "northshore-learning-center"
    );
    assert.equal(hasLegacyProfileGuideSlug("northshore-learning-center"), false);
  });
});
