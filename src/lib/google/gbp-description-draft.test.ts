import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTestAudit } from "@/audit/phase3/test-fixtures";
import {
  buildGbpDescriptionDraft,
  cityFromAddress,
  indefiniteArticle,
  looksLikeKeywordStuffedDescription,
  naturalKeywordPhrase,
} from "./gbp-description-draft";

describe("gbp-description-draft", () => {
  it("extracts city and skips state/ZIP segments", () => {
    assert.equal(cityFromAddress("123 Main St, Las Vegas, NV 89129"), "Las Vegas");
    assert.equal(cityFromAddress("123 Main St, Las Vegas, NV 89129, USA"), "Las Vegas");
    assert.equal(cityFromAddress("Las Vegas NV 89129"), "Las Vegas");
  });

  it("strips search-query junk and other-city tails from keyword phrases", () => {
    assert.equal(
      naturalKeywordPhrase("affordable daycares near me", "Las Vegas"),
      "daycares"
    );
    assert.equal(
      naturalKeywordPhrase("best learning center las vegas", "Las Vegas"),
      "learning center"
    );
    assert.equal(
      naturalKeywordPhrase(
        "hvac air conditioning heating repair near newark nj",
        "Ridgewood"
      ),
      "hvac air conditioning heating"
    );
    assert.equal(naturalKeywordPhrase("ac repair", "Ridgewood"), "ac repair");
    assert.equal(naturalKeywordPhrase("hvac kearny nj", "Ridgewood"), "hvac");
  });

  it("picks the correct indefinite article", () => {
    assert.equal(indefiniteArticle("air conditioning contractor"), "an");
    assert.equal(indefiniteArticle("plumber"), "a");
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
        "Wayne Refrigeration Air and Heat is a air conditioning contractor serving Ridgewood and nearby communities. The team is known for quality work, fair pricing, and scheduling delays, with a focus on hvac air conditioning heating repair newark nj. With 23+ Google reviews (4.300000190734863★), Wayne Refrigeration Air and Heat helps customers get dependable results close to home."
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

  it("keeps a strong HVAC live description instead of rewriting it into keyword stuffing", () => {
    const audit = createTestAudit();
    audit.clientName = "Wayne Refrigeration Air and Heat";
    audit.gbp.identity.address = "123 Main St, Ridgewood, NJ 07450";
    audit.gbp.identity.primaryCategory = "Air conditioning contractor";
    audit.gbp.engagement.reviewCount = 23;
    audit.gbp.engagement.averageRating = 4.300000190734863;
    audit.reviews.sentiment.positiveThemes = [
      "quality work",
      "fair pricing",
      "scheduling delays",
    ];
    audit.gbp.liveProfile = {
      ...audit.gbp.liveProfile!,
      description:
        "Wayne Refrigeration Air and Heat is your go-to HVAC contractor in Ridgewood, NJ, specializing in air conditioning installation, heating repair, and HVAC system maintenance. As a family-owned business, we pride ourselves on delivering honest, reliable service tailored to your needs. Whether you require emergency air conditioning repair or routine maintenance, our certified technicians are here to keep your home comfortable year-round. We also offer flexible financing options to make your HVAC installations and repairs stress-free. Trust Wayne Refrigeration for all your heating and cooling needs in Ridgewood and surrounding areas.",
      primaryCategory: "Air conditioning contractor",
      services: [
        { name: "Air conditioning repair", description: "" },
        { name: "Heating repair", description: "" },
        { name: "HVAC installation", description: "" },
      ],
    };
    audit.rankings.keywords = [
      {
        keyword: "hvac air conditioning heating repair near newark nj",
        localPackPosition: "not_in_pack",
        inLocalPack: false,
        clientReviewCount: 23,
        packLeaderReviewCount: 80,
        packLeaderRating: 4.8,
        clientRating: 4.3,
        geoRanks: [],
      },
      {
        keyword: "local hvac contractors ridgewood",
        localPackPosition: 2,
        inLocalPack: true,
        clientReviewCount: 23,
        packLeaderReviewCount: 80,
        packLeaderRating: 4.8,
        clientRating: 4.3,
        geoRanks: [],
      },
      {
        keyword: "ac repair",
        localPackPosition: "not_in_pack",
        inLocalPack: false,
        clientReviewCount: 23,
        packLeaderReviewCount: 80,
        packLeaderRating: 4.8,
        clientRating: 4.3,
        geoRanks: [],
      },
      {
        keyword: "hvac kearny nj",
        localPackPosition: "not_in_pack",
        inLocalPack: false,
        clientReviewCount: 23,
        packLeaderReviewCount: 80,
        packLeaderRating: 4.8,
        clientRating: 4.3,
        geoRanks: [],
      },
    ];

    const draft = buildGbpDescriptionDraft(audit);
    assert.match(draft, /go-to HVAC contractor in Ridgewood/);
    assert.doesNotMatch(draft, /scheduling delays/i);
    assert.doesNotMatch(draft, /4\.300000190734863/);
    assert.doesNotMatch(draft, /with a focus on/i);
    assert.doesNotMatch(draft, /hvac kearny nj/i);
    assert.equal(looksLikeKeywordStuffedDescription(draft), false);
  });

  it("builds a natural fresh description when no live copy exists", () => {
    const audit = createTestAudit();
    audit.clientName = "Wayne Refrigeration Air and Heat";
    audit.gbp.liveProfile = {
      ...audit.gbp.liveProfile!,
      description: "",
      services: [],
    };
    audit.gbp.identity.address = "123 Main St, Ridgewood, NJ 07450";
    audit.gbp.identity.primaryCategory = "Air conditioning contractor";
    audit.gbp.engagement.reviewCount = 23;
    audit.gbp.engagement.averageRating = 4.300000190734863;
    audit.reviews.sentiment.positiveThemes = [
      "quality work",
      "fair pricing",
      "scheduling delays",
    ];
    audit.rankings.keywords = [
      {
        keyword: "hvac air conditioning heating repair near newark nj",
        localPackPosition: "not_in_pack",
        inLocalPack: false,
        clientReviewCount: 23,
        packLeaderReviewCount: 80,
        packLeaderRating: 4.8,
        clientRating: 4.3,
        geoRanks: [],
      },
      {
        keyword: "ac repair",
        localPackPosition: "not_in_pack",
        inLocalPack: false,
        clientReviewCount: 23,
        packLeaderReviewCount: 80,
        packLeaderRating: 4.8,
        clientRating: 4.3,
        geoRanks: [],
      },
    ];

    const draft = buildGbpDescriptionDraft(audit);
    assert.equal(looksLikeKeywordStuffedDescription(draft), false);
    assert.match(draft, /is an air conditioning contractor/i);
    assert.match(draft, /Ridgewood/);
    assert.match(draft, /4\.30★/);
    assert.doesNotMatch(draft, /4\.300000190734863/);
    assert.doesNotMatch(draft, /scheduling delays/i);
    assert.doesNotMatch(draft, /is a air conditioning/i);
    assert.doesNotMatch(draft, /We specialize in .+, .+, .+/i);
    assert.doesNotMatch(draft, /clean vehicles/i);
  });
});
