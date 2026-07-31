import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isRetryableProviderError,
  shouldRetryOutreach,
} from "@/lib/review-requests/outreach-retry";

describe("isRetryableProviderError", () => {
  it("detects rate limit status codes", () => {
    assert.equal(isRetryableProviderError("error", 429), true);
    assert.equal(isRetryableProviderError("error", 503), true);
  });

  it("detects rate limit messages", () => {
    assert.equal(isRetryableProviderError("Rate limit exceeded"), true);
    assert.equal(isRetryableProviderError("Request timeout"), true);
  });

  it("ignores permanent failures", () => {
    assert.equal(isRetryableProviderError("Invalid phone number", 400), false);
    assert.equal(isRetryableProviderError("Unsubscribed recipient"), false);
  });
});

describe("shouldRetryOutreach", () => {
  it("allows retries below the max", () => {
    assert.equal(shouldRetryOutreach(0), true);
    assert.equal(shouldRetryOutreach(2), true);
  });

  it("stops after max retries", () => {
    assert.equal(shouldRetryOutreach(3), false);
  });
});
