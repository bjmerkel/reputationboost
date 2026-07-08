import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMediaHostUrl,
  createMediaHostToken,
  signMediaHostToken,
  verifyMediaHostToken,
} from "./gbp-media-host";

describe("gbp-media-host tokens", () => {
  it("creates and verifies a signed host token", () => {
    process.env.GBP_MEDIA_HOST_SECRET = "test-secret";
    const taskId = "b987f09f-bc18-42c5-8eb8-957d87cb6179";
    const expiresAt = Date.now() + 60_000;
    const token = signMediaHostToken(taskId, expiresAt);

    assert.equal(verifyMediaHostToken(taskId, token), true);
    assert.equal(verifyMediaHostToken("other-task", token), false);
  });

  it("builds a public host URL for Google sourceUrl uploads", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://app.example.com";
    const url = buildMediaHostUrl("task-1", "token-1");
    assert.equal(url, "https://app.example.com/api/google/gbp/media/host/task-1/token-1");
  });

  it("creates a token that expires in the future", () => {
    process.env.GBP_MEDIA_HOST_SECRET = "test-secret";
    const token = createMediaHostToken("task-1");
    assert.equal(verifyMediaHostToken("task-1", token), true);
  });
});
