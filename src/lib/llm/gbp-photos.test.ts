import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildOpenAiImageRequestBody } from "./gbp-photos";

describe("buildOpenAiImageRequestBody", () => {
  it("omits response_format for gpt-image models", () => {
    const body = buildOpenAiImageRequestBody("A service van at work", "gpt-image-2");
    assert.equal(body.model, "gpt-image-2");
    assert.equal(body.size, "1536x1024");
    assert.equal(body.quality, "high");
    assert.equal(body.response_format, undefined);
  });

  it("includes response_format for dall-e-3", () => {
    const body = buildOpenAiImageRequestBody("A service van at work", "dall-e-3");
    assert.equal(body.response_format, "b64_json");
    assert.equal(body.style, "natural");
    assert.equal(body.quality, "hd");
  });
});
