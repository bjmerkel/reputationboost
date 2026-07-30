import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildTextUsUrl } from "./theme";

describe("buildTextUsUrl", () => {
  it("builds sms link with encoded body", () => {
    const url = buildTextUsUrl("+15125550100", "Hi there!");
    assert.match(url, /^sms:\+15125550100\?body=/);
    assert.ok(url.includes(encodeURIComponent("Hi there!")));
  });

  it("returns plain sms link without message", () => {
    assert.equal(buildTextUsUrl("5551234", null), "sms:5551234");
  });
});
