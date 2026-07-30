import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { customersTabHref, parseCustomersTab } from "./tabs";

describe("parseCustomersTab", () => {
  it("defaults to review-requests", () => {
    assert.equal(parseCustomersTab(undefined), "review-requests");
    assert.equal(parseCustomersTab("invalid"), "review-requests");
  });

  it("accepts profile-guide", () => {
    assert.equal(parseCustomersTab("profile-guide"), "profile-guide");
  });
});

describe("customersTabHref", () => {
  it("omits tab param for the default tab", () => {
    assert.equal(customersTabHref("review-requests", "biz-1"), "/platform/customers?businessId=biz-1");
  });

  it("includes tab param for profile guide", () => {
    assert.equal(
      customersTabHref("profile-guide", "biz-1"),
      "/platform/customers?businessId=biz-1&tab=profile-guide"
    );
  });
});
