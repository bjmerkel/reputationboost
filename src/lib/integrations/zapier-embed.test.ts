import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildZapierCreateZapUrl,
  buildZapierEmbedUrl,
  getZapierEmbedConfig,
} from "./zapier-embed";

describe("zapier-embed", () => {
  it("builds embed URL with prefilled webhook", () => {
    const url = buildZapierEmbedUrl(
      "reputation-boost",
      "113",
      "https://example.com/api/integrations/webhook?token=wb_test"
    );
    assert.match(url, /^https:\/\/api\.zapier\.com\/v1\/embed\/reputation-boost\/create\/113\?/);
    assert.match(url, /steps%5B1%5D%5Bparams%5D%5Bwebhook_url%5D=/);
  });

  it("returns disabled config when no template env vars are set", () => {
    const config = getZapierEmbedConfig("https://example.com/webhook");
    assert.equal(config.enabled, false);
    assert.equal(config.templates.length, 0);
    assert.match(config.createZapUrl, /zapier\.com\/apps\/reputation-boost/);
  });

  it("includes templates when env vars are present", () => {
    process.env.ZAPIER_TEMPLATE_JOBBER = "42";
    try {
      const config = getZapierEmbedConfig("https://example.com/webhook?token=wb_x");
      assert.equal(config.enabled, true);
      assert.equal(config.templates.length, 1);
      assert.equal(config.templates[0]?.id, "jobber-job-completed");
      assert.match(config.templates[0]?.createUrl ?? "", /create\/42/);
    } finally {
      delete process.env.ZAPIER_TEMPLATE_JOBBER;
    }
  });

  it("builds app directory URL", () => {
    const url = buildZapierCreateZapUrl("reputation-boost");
    assert.match(url, /zapier\.com\/apps\/reputation-boost\/integrations/);
  });
});
