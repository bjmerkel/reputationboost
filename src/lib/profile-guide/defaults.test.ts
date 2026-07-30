import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDefaultProfileGuideLinks } from "./defaults";
import type { ClientConfig } from "@/audit/types";

function sampleBusiness(overrides: Partial<ClientConfig> = {}): ClientConfig {
  return {
    id: "client-1",
    businessId: "11111111-2222-3333-4444-555555555555",
    name: "Joe's Plumbing",
    industry: "Plumber",
    location: {
      address: "1 Main St",
      city: "Austin",
      state: "TX",
      zip: "78701",
      lat: 0,
      lng: 0,
    },
    keywords: [],
    gbpPlaceId: "ChIJtest",
    gbpMapsUrl: "https://maps.google.com/?cid=123",
    website: "https://joesplumbing.example",
    phone: "+15125550100",
    ...overrides,
  };
}

describe("buildDefaultProfileGuideLinks", () => {
  it("creates six default links from business data", () => {
    const links = buildDefaultProfileGuideLinks(sampleBusiness());
    assert.equal(links.length, 6);
    assert.equal(links[0]?.linkType, "review");
    assert.match(links[0]?.url ?? "", /writereview|placeid/i);
    assert.equal(links[2]?.linkType, "website");
    assert.equal(links[2]?.enabled, true);
    assert.match(links[4]?.url ?? "", /^tel:/);
    assert.match(links[5]?.url ?? "", /^sms:/);
  });

  it("disables links when data is missing", () => {
    const links = buildDefaultProfileGuideLinks(
      sampleBusiness({ website: undefined, phone: undefined, gbpPlaceId: undefined, gbpMapsUrl: undefined })
    );
    const website = links.find((link) => link.linkType === "website");
    assert.equal(website?.enabled, false);
  });
});
