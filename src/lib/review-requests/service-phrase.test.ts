import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  naturalServicePhrase,
  normalizeKeywordInReviewTemplate,
  resolveServiceForSms,
} from "./service-phrase";

const lasVegas = { city: "Las Vegas", state: "NV" };

describe("naturalServicePhrase", () => {
  it("strips trailing city from SEO keywords", () => {
    assert.equal(
      naturalServicePhrase("enrichment programs las vegas", lasVegas),
      "enrichment programs"
    );
    assert.equal(
      naturalServicePhrase("after school programs las vegas", lasVegas),
      "after school programs"
    );
  });

  it("strips in-city phrases", () => {
    assert.equal(
      naturalServicePhrase("tutoring in las vegas", lasVegas),
      "tutoring"
    );
  });
});

describe("resolveServiceForSms", () => {
  it("prefers customer service notes but still naturalizes them", () => {
    assert.equal(
      resolveServiceForSms({
        serviceNotes: "enrichment programs las vegas",
        focusKeyword: "after school programs las vegas",
        location: lasVegas,
      }),
      "enrichment programs"
    );
  });

  it("falls back to naturalized focus keyword", () => {
    assert.equal(
      resolveServiceForSms({
        focusKeyword: "enrichment programs las vegas",
        location: lasVegas,
      }),
      "enrichment programs"
    );
  });
});

describe("normalizeKeywordInReviewTemplate", () => {
  it("rewrites pasted SEO keywords to [SERVICE]", () => {
    const template =
      "Hi [FIRST_NAME], it's [BUSINESS]. We're so glad you enjoyed our enrichment programs las vegas! [REVIEW_LINK]";
    const normalized = normalizeKeywordInReviewTemplate(
      template,
      "enrichment programs las vegas",
      lasVegas
    );
    assert.match(normalized, /our \[SERVICE\]/);
    assert.doesNotMatch(normalized, /enrichment programs las vegas/i);
  });

  it("rewrites natural phrase with city back to [SERVICE]", () => {
    const template =
      "Thanks for visiting! Families looking for enrichment programs in Las Vegas appreciate your feedback. [REVIEW_LINK]";
    const normalized = normalizeKeywordInReviewTemplate(
      template,
      "enrichment programs las vegas",
      lasVegas
    );
    assert.match(normalized, /\[SERVICE\]/);
    assert.doesNotMatch(normalized, /enrichment programs in Las Vegas/i);
  });
});
