import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDemoGeoGrid } from "@/lib/google/geo-grid";

describe("buildDemoGeoGrid", () => {
  const center = { lat: 40.7128, lng: -74.006 };

  it("scales rank drift when search radius increases", () => {
    const at1Mi = buildDemoGeoGrid(center, 4, "compact", 1);
    const at10Mi = buildDemoGeoGrid(center, 4, "compact", 10);

    const corner1 = at1Mi.find((p) => p.offsetNorthMiles > 0 && p.offsetEastMiles > 0);
    const corner10 = at10Mi.find(
      (p) =>
        p.offsetNorthMiles === corner1?.offsetNorthMiles &&
        p.offsetEastMiles === corner1?.offsetEastMiles
    );

    assert.ok(corner1?.rank != null && corner10?.rank != null);
    assert.ok(corner10.rank > corner1.rank);
  });
});
