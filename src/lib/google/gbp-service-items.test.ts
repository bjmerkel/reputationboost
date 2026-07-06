import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyServiceItems } from "./gbp-apply";
import {
  buildFreeFormServiceItem,
  buildServiceItemsPatch,
  categoryStableId,
  normalizeServiceItemForPatch,
  sanitizeServiceText,
} from "./gbp-service-items";

describe("categoryStableId", () => {
  it("converts resource names and bare ids to stable gcid format", () => {
    assert.equal(categoryStableId("categories/gcid:car_repair"), "gcid:car_repair");
    assert.equal(categoryStableId("gcid:car_repair"), "gcid:car_repair");
    assert.equal(categoryStableId("car_repair"), "gcid:car_repair");
  });
});

describe("sanitizeServiceText", () => {
  it("strips URLs and phone numbers and caps length", () => {
    const text = sanitizeServiceText(
      "Expert CarPlay installs. Call (703) 820-5400 or visit https://example.com today.",
      250
    );
    assert.doesNotMatch(text, /820|5400|https?:/);
    assert.match(text, /Expert CarPlay installs/);
  });
});

describe("buildFreeFormServiceItem", () => {
  it("uses the stable category id, not the resource name", () => {
    const item = buildFreeFormServiceItem(
      "categories/gcid:car_repair",
      "CarPlay Installation",
      "Expert installation of Apple CarPlay systems."
    ) as { freeFormServiceItem: { category: string; label: { displayName: string } } };

    assert.equal(item.freeFormServiceItem.category, "gcid:car_repair");
    assert.equal(item.freeFormServiceItem.label.displayName, "CarPlay Installation");
  });
});

describe("normalizeServiceItemForPatch", () => {
  it("fixes category format on existing free-form items", () => {
    const normalized = normalizeServiceItemForPatch({
      freeFormServiceItem: {
        category: "categories/gcid:car_repair",
        label: { displayName: "Oil Change", description: "Quick oil change." },
      },
    }) as { freeFormServiceItem: { category: string } };
    assert.equal(normalized.freeFormServiceItem.category, "gcid:car_repair");
  });

  it("accepts the categoryId alias returned by some API surfaces", () => {
    const normalized = normalizeServiceItemForPatch({
      freeFormServiceItem: {
        categoryId: "gcid:car_repair",
        label: { displayName: "Oil Change" },
      },
    }) as { freeFormServiceItem: { category: string } };
    assert.equal(normalized.freeFormServiceItem.category, "gcid:car_repair");
  });

  it("drops items that would fail INVALID_SERVICE_ITEM", () => {
    assert.equal(normalizeServiceItemForPatch({}), null);
    assert.equal(
      normalizeServiceItemForPatch({ freeFormServiceItem: { label: { displayName: "X" } } }),
      null
    );
  });

  it("preserves structured items and their price", () => {
    const normalized = normalizeServiceItemForPatch({
      structuredServiceItem: { serviceTypeId: "job_type_id:oil_change", description: "desc" },
      price: { currencyCode: "USD", units: "30" },
    }) as { structuredServiceItem: { serviceTypeId: string }; price: { currencyCode: string } };
    assert.equal(normalized.structuredServiceItem.serviceTypeId, "job_type_id:oil_change");
    assert.equal(normalized.price.currencyCode, "USD");
  });
});

describe("buildServiceItemsPatch", () => {
  const existingRaw = [
    {
      freeFormServiceItem: {
        category: "categories/gcid:car_repair",
        label: { displayName: "Oil Change" },
      },
    },
    { structuredServiceItem: { serviceTypeId: "job_type_id:brake_repair" } },
  ];

  it("keeps existing services and appends new ones, deduplicated", () => {
    const patch = buildServiceItemsPatch({
      existingRaw,
      primaryCategoryName: "categories/gcid:car_repair",
      additions: [
        { name: "CarPlay Installation", description: "Expert installs." },
        { name: "Oil Change", description: "dup by name" },
        { name: "Brake Repair", description: "dup by type", serviceTypeId: "job_type_id:brake_repair" },
      ],
    });

    assert.equal(patch.serviceItems.length, 3);
    assert.deepEqual(patch.added, ["CarPlay Installation"]);
    assert.deepEqual(patch.skipped.sort(), ["Brake Repair", "Oil Change"]);
  });

  it("adds structured items when a serviceTypeId is resolved", () => {
    const patch = buildServiceItemsPatch({
      existingRaw: [],
      primaryCategoryName: "categories/gcid:car_repair",
      additions: [
        { name: "Wheel Alignment", description: "Precise alignment.", serviceTypeId: "job_type_id:wheel_alignment" },
      ],
    });
    const item = patch.serviceItems[0] as {
      structuredServiceItem: { serviceTypeId: string; description: string };
    };
    assert.equal(item.structuredServiceItem.serviceTypeId, "job_type_id:wheel_alignment");
    assert.equal(item.structuredServiceItem.description, "Precise alignment.");
  });
});

describe("applyServiceItems", () => {
  const connection = {
    businessId: "b1",
    accountId: "a1",
    locationId: "123",
    accessToken: "fake-token",
    refreshToken: "refresh",
    expiresAt: new Date().toISOString(),
  };

  it("patches the full service list with stable category ids and verifies", async () => {
    const originalFetch = globalThis.fetch;
    const patches: Array<{ url: URL; body: string }> = [];
    let profileCalls = 0;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));

      if (init?.method === "PATCH") {
        patches.push({ url, body: String(init.body) });
        return new Response(JSON.stringify({}), { status: 200 });
      }
      if (url.pathname.includes("categories:batchGet")) {
        return new Response(
          JSON.stringify({
            categories: [
              {
                name: "categories/gcid:car_repair",
                displayName: "Car repair",
                serviceTypes: [
                  { serviceTypeId: "job_type_id:oil_change", displayName: "Oil change" },
                ],
              },
            ],
          }),
          { status: 200 }
        );
      }

      // locations.get — before and after the patch
      profileCalls += 1;
      const serviceItems =
        profileCalls === 1
          ? []
          : [
              {
                freeFormServiceItem: {
                  category: "gcid:car_repair",
                  label: { displayName: "CarPlay Installation" },
                },
              },
            ];
      return new Response(
        JSON.stringify({
          name: "locations/123",
          categories: { primaryCategory: { name: "categories/gcid:car_repair", displayName: "Car repair" } },
          serviceItems,
          metadata: { canModifyServiceList: true },
        }),
        { status: 200 }
      );
    }) as typeof fetch;

    try {
      const result = await applyServiceItems(connection, [
        { name: "CarPlay Installation", description: "Expert CarPlay installs in Arlington." },
      ]);

      assert.equal(result.success, true);
      assert.match(result.message, /CarPlay Installation/);

      // validateOnly + real patch
      assert.equal(patches.length, 2);
      assert.equal(patches[0].url.searchParams.get("updateMask"), "serviceItems");
      assert.equal(patches[0].url.searchParams.get("validateOnly"), "true");
      assert.equal(patches[1].url.searchParams.get("validateOnly"), null);

      const body = JSON.parse(patches[1].body) as {
        serviceItems: Array<{ freeFormServiceItem?: { category: string } }>;
      };
      assert.equal(body.serviceItems[0].freeFormServiceItem?.category, "gcid:car_repair");
      assert.doesNotMatch(patches[1].body, /categories\/gcid/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("refuses to patch when Google disallows service list edits", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          name: "locations/123",
          categories: { primaryCategory: { name: "categories/gcid:car_repair", displayName: "Car repair" } },
          serviceItems: [],
          metadata: { canModifyServiceList: false },
        }),
        { status: 200 }
      )) as typeof fetch;

    try {
      await assert.rejects(
        () => applyServiceItems(connection, [{ name: "Oil Change", description: "" }]),
        /Business Profile Manager/
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
