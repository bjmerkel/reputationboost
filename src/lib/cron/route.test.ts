import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { verifyCronRequest } from "./route";

describe("verifyCronRequest", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.CRON_SECRET = "test-secret";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    process.env.NODE_ENV = "production";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("rejects requests without a bearer token", () => {
    const response = verifyCronRequest(new Request("http://localhost/api/cron/test"), "test");
    assert.ok(response);
    assert.equal(response.status, 401);
  });

  it("accepts a matching bearer token", () => {
    const response = verifyCronRequest(
      new Request("http://localhost/api/cron/test", {
        headers: { authorization: "Bearer test-secret" },
      }),
      "test"
    );
    assert.equal(response, null);
  });

  it("trims trailing whitespace from CRON_SECRET", () => {
    process.env.CRON_SECRET = "test-secret\n";
    const response = verifyCronRequest(
      new Request("http://localhost/api/cron/test", {
        headers: { authorization: "Bearer test-secret" },
      }),
      "test"
    );
    assert.equal(response, null);
  });
});
