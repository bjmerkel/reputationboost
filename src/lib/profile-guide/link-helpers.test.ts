import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countCustomProfileGuideLinks,
  isNewProfileGuideLinkId,
  MAX_CUSTOM_PROFILE_GUIDE_LINKS,
} from "./link-helpers";

describe("isNewProfileGuideLinkId", () => {
  it("treats missing ids as new", () => {
    assert.equal(isNewProfileGuideLinkId(undefined), true);
  });

  it("treats new- prefixed ids as new", () => {
    assert.equal(isNewProfileGuideLinkId("new-abc"), true);
  });

  it("treats persisted ids as existing", () => {
    assert.equal(isNewProfileGuideLinkId("550e8400-e29b-41d4-a716-446655440000"), false);
  });
});

describe("countCustomProfileGuideLinks", () => {
  it("counts custom links using linkType or link_type", () => {
    assert.equal(
      countCustomProfileGuideLinks([
        { linkType: "review" },
        { link_type: "custom" },
        { linkType: "custom" },
      ]),
      2
    );
  });
});

describe("MAX_CUSTOM_PROFILE_GUIDE_LINKS", () => {
  it("is a positive limit", () => {
    assert.ok(MAX_CUSTOM_PROFILE_GUIDE_LINKS > 0);
  });
});
