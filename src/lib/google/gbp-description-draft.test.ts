import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTestAudit } from "@/audit/phase3/test-fixtures";
import {
  buildGbpDescriptionDraft,
  cityFromAddress,
  looksLikeKeywordStuffedDescription,
  naturalKeywordPhrase,
} from "./gbp-description-draft";

describe("gbp-description-draft", () => {
  it("extracts city and skips state/ZIP segments", () => {
    assert.equal(cityFromAddress("123 Main St, Las Vegas, NV 89129"), "Las Vegas");
    assert.equal(cityFromAddress("123 Main St, Las Vegas, NV 89129, USA"), "Las Vegas");
    assert.equal(cityFromAddress("Las Vegas NV 89129"), "Las Vegas");
  });

  it("strips search-query junk from keyword phrases", () => {
    assert.equal(
      naturalKeywordPhrase("affordable daycares near me", "Las Vegas"),
      "daycares"
    );
    assert.equal(
      naturalKeywordPhrase("best learning center las vegas", "Las Vegas"),
      "learning center"
    );
  });

  it("detects the legacy keyword-stuffed template", () => {
    assert.equal(
      looksLikeKeywordStuffedDescription(
        "Northshore Learning Center provides professional Day care center throughout NV 89129 and surrounding areas. We specialize in learning center near me, daycare near las vegas, preschool near me. With 62+ Google reviews (4.4★), Northshore Learning Center delivers reliable service, clean vehicles, punctual arrivals, and professional staff, with 24/7 availability."
      ),
      true
    );
    assert.equal(
      looksLikeKeywordStuffedDescription(
        "Nestled in Las Vegas since 1997, Northshore Learning Center offers a safe and supportive environment where children can learn, play, and grow."
      ),
      false
    );
  });

  it("enhances a strong live description instead of replacing it with a keyword list", () => {
    const audit = createTestAudit();
    audit.clientName = "Northshore Learning Center";
    audit.gbp.identity.address = "123 Main St, Las Vegas, NV 89129";
    audit.gbp.identity.primaryCategory = "Day care center";
    audit.gbp.engagement.reviewCount = 62;
    audit.gbp.engagement.averageRating = 4.4;
    audit.gbp.liveProfile = {
      ...audit.gbp.liveProfile!,
      description:
        "Nestled in Las Vegas since 1997, Northshore Learning Center offers a safe and supportive environment where children from 6 weeks to 12 years can learn, play, and grow. As a nurturing daycare center, preschool, after-school program, and child care agency, they provide a balance of group learning times and free play to stimulate each child's development. Their dedicated team is committed to fostering a joyful and engaging atmosphere where every child can thrive.",
      primaryCategory: "Day care center",
    };
    audit.rankings.keywords = [
      {
        keyword: "affordable daycares near me",
        localPackPosition: "not_in_pack",
        inLocalPack: false,
        clientReviewCount: 62,
        packLeaderReviewCount: 100,
        packLeaderRating: 4.8,
        clientRating: 4.4,
        geoRanks: [],
      },
      {
        keyword: "learning center near me",
        localPackPosition: 2,
        inLocalPack: true,
        clientReviewCount: 62,
        packLeaderReviewCount: 100,
        packLeaderRating: 4.8,
        clientRating: 4.4,
        geoRanks: [],
      },
    ];

    const draft = buildGbpDescriptionDraft(audit);

    assert.equal(looksLikeKeywordStuffedDescription(draft), false);
    assert.match(draft, /Nestled in Las Vegas since 1997/);
    assert.doesNotMatch(draft, /We specialize in .+, .+, .+/i);
    assert.doesNotMatch(draft, /clean vehicles/i);
    assert.doesNotMatch(draft, /\bnear me\b/i);
    assert.doesNotMatch(draft, /NV 89129/);
  });

  it("builds a natural fresh description when no live copy exists", () => {
    const audit = createTestAudit();
    audit.gbp.liveProfile = {
      ...audit.gbp.liveProfile!,
      description: "",
    };
    audit.gbp.identity.address = "123 Main St, Dallas, TX 75201";

    const draft = buildGbpDescriptionDraft(audit);
    assert.equal(looksLikeKeywordStuffedDescription(draft), false);
    assert.match(draft, /Dallas/);
    assert.doesNotMatch(draft, /We specialize in .+, .+, .+/i);
    assert.doesNotMatch(draft, /clean vehicles/i);
  });
});
