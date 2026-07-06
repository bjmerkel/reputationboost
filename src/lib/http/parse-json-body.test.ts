import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseJsonBody } from "@/lib/http/parse-json-body";

describe("parseJsonBody", () => {
  it("returns empty object for missing body", async () => {
    const request = new Request("https://example.com/api/test", { method: "POST" });
    const body = await parseJsonBody<{ customerId?: string }>(request);
    assert.deepEqual(body, {});
  });

  it("parses JSON object bodies", async () => {
    const request = new Request("https://example.com/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId: "abc" }),
    });
    const body = await parseJsonBody<{ customerId?: string }>(request);
    assert.equal(body.customerId, "abc");
  });

  it("throws for invalid JSON", async () => {
    const request = new Request("https://example.com/api/test", {
      method: "POST",
      body: "{not json",
    });
    await assert.rejects(() => parseJsonBody(request), /Invalid JSON request body/);
  });
});
