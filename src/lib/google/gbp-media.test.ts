import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildGbpMediaUploadUrl, dataUrlToBytes } from "./gbp-media";

describe("dataUrlToBytes", () => {
  it("decodes a standard PNG data URL", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const dataUrl = `data:image/png;base64,${png.toString("base64")}`;
    const { bytes, contentType } = dataUrlToBytes(dataUrl);

    assert.equal(contentType, "image/png");
    assert.deepEqual(new Uint8Array(bytes), new Uint8Array(png));
  });

  it("decodes data URLs with extra parameters before base64", () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xdb]);
    const dataUrl = `data:image/jpeg;charset=utf-8;base64,${jpeg.toString("base64")}`;
    const { bytes, contentType } = dataUrlToBytes(dataUrl);

    assert.equal(contentType, "image/jpeg");
    assert.deepEqual(new Uint8Array(bytes), new Uint8Array(jpeg));
  });

  it("rejects invalid data URLs", () => {
    assert.throws(() => dataUrlToBytes("not-a-data-url"), /Invalid image preview data/);
  });
});

describe("buildGbpMediaUploadUrl", () => {
  it("matches Google byte-upload endpoint shape", () => {
    const url = buildGbpMediaUploadUrl("media/AGj0abc123");
    assert.equal(
      url,
      "https://mybusiness.googleapis.com/upload/v1/media/media/AGj0abc123?uploadType=media&upload_type=media"
    );
  });

  it("encodes special characters in resource names", () => {
    const url = buildGbpMediaUploadUrl("media/name with spaces");
    assert.match(url, /\/media\/name%20with%20spaces\?/);
    assert.match(url, /uploadType=media/);
    assert.match(url, /upload_type=media/);
  });
});
