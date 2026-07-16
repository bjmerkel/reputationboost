import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildZapierCreateZapUrl,
  buildZapierEmbedUrl,
  buildZapierPairUrl,
  buildZapierSetupUrl,
  buildZapierWebIntentUrl,
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

  it("builds app pair URLs for each tool", () => {
    const url = buildZapierPairUrl("jobber", "reputation-boost");
    assert.match(url, /zapier\.com\/apps\/jobber\/integrations\/reputation-boost/);
  });

  it("uses webintent for create zap fallback", () => {
    const url = buildZapierWebIntentUrl();
    assert.match(url, /zapier\.com\/webintent\/create-zap/);
    assert.match(url, /utm_source=reputation_boost/);
  });

  it("returns tool-specific setup URLs without template env vars", () => {
    const config = getZapierEmbedConfig("https://example.com/webhook?token=wb_x");
    assert.equal(config.enabled, false);
    assert.equal(config.templates.length, 4);
    assert.match(config.createZapUrl, /webintent\/create-zap/);

    const jobber = config.templates.find((t) => t.id === "jobber-job-completed");
    assert.match(jobber?.createUrl ?? "", /jobber\/integrations\/reputation-boost/);
    assert.equal(jobber?.embedUrl, null);
  });

  it("includes embed iframe URL when template env vars are present", () => {
    process.env.ZAPIER_TEMPLATE_JOBBER = "42";
    try {
      const config = getZapierEmbedConfig("https://example.com/webhook?token=wb_x");
      assert.equal(config.enabled, true);
      const jobber = config.templates.find((t) => t.id === "jobber-job-completed");
      assert.match(jobber?.createUrl ?? "", /create\/42/);
      assert.equal(jobber?.embedUrl, jobber?.createUrl);
    } finally {
      delete process.env.ZAPIER_TEMPLATE_JOBBER;
    }
  });

  it("buildZapierSetupUrl prefers embed when published template exists", () => {
    const url = buildZapierSetupUrl(
      "jobber-job-completed",
      "reputation-boost",
      "https://example.com/webhook?token=wb_x",
      "99"
    );
    assert.match(url, /embed\/reputation-boost\/create\/99/);
  });

  it("buildZapierCreateZapUrl uses webintent", () => {
    assert.match(buildZapierCreateZapUrl("reputation-boost"), /webintent\/create-zap/);
  });
});
