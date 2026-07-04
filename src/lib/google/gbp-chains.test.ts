import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getGbpChain, searchGbpChains } from "./gbp-chains";

describe("gbp-chains", () => {
  it("parses chain search results", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("chains:search")) {
        return new Response(
          JSON.stringify({
            chains: [
              {
                name: "chains/costco",
                chainNames: [{ displayName: "Costco", languageCode: "en" }],
                websites: [{ uri: "https://www.costco.com" }],
                locationCount: 600,
              },
            ],
          }),
          { status: 200 }
        );
      }
      if (url.endsWith("/chains/costco")) {
        return new Response(
          JSON.stringify({
            name: "chains/costco",
            chainNames: [{ displayName: "Costco Wholesale", languageCode: "en" }],
            locationCount: 600,
          }),
          { status: 200 }
        );
      }
      return originalFetch(input, init);
    }) as typeof fetch;

    try {
      const chains = await searchGbpChains("fake-token", "Costco");
      assert.equal(chains[0].chainId, "costco");
      assert.equal(chains[0].displayName, "Costco");

      const chain = await getGbpChain("fake-token", "chains/costco");
      assert.equal(chain?.displayName, "Costco Wholesale");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
