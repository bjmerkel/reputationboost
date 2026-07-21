import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FullAuditPayload } from "@/audit/types";
import { matchTransactionToKeyword } from "./match-keyword";
import { matchTransactionToCell } from "./match-cell";
import { cellRevenueKey } from "./match-cell";

function stubAudit(keywords: string[]): FullAuditPayload {
  return {
    rankings: {
      keywords: keywords.map((keyword) => ({
        keyword,
        localPackPosition: 5,
        inLocalPack: false,
        geoRanks: [],
      })),
    },
    gbp: {
      performance: {
        searchKeywords: keywords.map((keyword, index) => ({
          keyword,
          impressions: 1000 - index * 100,
        })),
      },
    },
    strategy: {
      gbpPlan: { targetKeywords: keywords },
    },
  } as unknown as FullAuditPayload;
}

describe("matchTransactionToKeyword", () => {
  it("matches exact service text to audit keyword", () => {
    const audit = stubAudit(["emergency plumber", "drain cleaning"]);
    const result = matchTransactionToKeyword("emergency plumber", audit);
    assert.equal(result.keyword, "emergency plumber");
    assert.equal(result.method, "service_keyword");
    assert.equal(result.confidence, 0.95);
  });

  it("fuzzy-matches partial service text", () => {
    const audit = stubAudit(["emergency plumber", "drain cleaning"]);
    const result = matchTransactionToKeyword("clogged drain cleaning service", audit);
    assert.equal(result.keyword, "drain cleaning");
    assert.equal(result.method, "fuzzy_keyword");
  });

  it("falls back to top impression keyword when service is unknown", () => {
    const audit = stubAudit(["emergency plumber", "drain cleaning"]);
    const result = matchTransactionToKeyword("misc repair", audit);
    assert.equal(result.keyword, "emergency plumber");
    assert.equal(result.method, "impression_fallback");
    assert.equal(result.confidence, 0.4);
  });
});

describe("matchTransactionToCell", () => {
  it("snaps job coordinates to nearest grid cell", () => {
    const result = matchTransactionToCell(
      { jobLat: 32.801, jobLng: -96.801 },
      {
        location: { lat: 32.8, lng: -96.8 },
        heatmapProfile: "compact",
      }
    );

    assert.notEqual(result.gridNorth, null);
    assert.notEqual(result.gridEast, null);
    assert.ok(result.zone);
  });
});

describe("cellRevenueKey", () => {
  it("builds stable cell keys", () => {
    assert.equal(cellRevenueKey("Emergency Plumber", 1.5, -0.5), "emergency plumber|1.5|-0.5");
  });
});
