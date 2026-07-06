import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyDescription } from "./gbp-apply";
import { isGbpDescriptionLiveSync } from "./gbp-description";

const connection = {
  businessId: "b1",
  accountId: "a1",
  locationId: "123",
  accessToken: "fake-token",
  refreshToken: "refresh",
  expiresAt: new Date().toISOString(),
};

interface MockOptions {
  liveDescription?: string;
  profileReadFails?: boolean;
  onPatch?: (url: URL, body: string) => void;
}

function mockGbpFetch(options: MockOptions): () => void {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));

    if (url.pathname.endsWith(":getGoogleUpdated")) {
      return new Response(JSON.stringify({ location: {}, diffMask: "", pendingMask: "" }), {
        status: 200,
      });
    }

    if (init?.method === "PATCH") {
      options.onPatch?.(url, String(init.body));
      return new Response(JSON.stringify({}), { status: 200 });
    }

    // locations.get verification read
    if (options.profileReadFails) {
      return new Response(
        JSON.stringify({
          error: { code: 400, message: "Request contains an invalid argument.", status: "INVALID_ARGUMENT" },
        }),
        { status: 400 }
      );
    }
    return new Response(
      JSON.stringify({
        name: "locations/123",
        profile: { description: options.liveDescription ?? "" },
        metadata: {},
      }),
      { status: 200 }
    );
  }) as typeof fetch;

  return () => {
    globalThis.fetch = originalFetch;
  };
}

describe("applyDescription", () => {
  it("patches profile.description and verifies against the live profile", async () => {
    const description = "Family-owned RV dealership serving Dallas since 1998.";
    const patches: string[] = [];
    const restore = mockGbpFetch({
      liveDescription: description,
      onPatch: (url, body) => {
        assert.equal(url.searchParams.get("updateMask"), "profile.description");
        patches.push(body);
      },
    });

    try {
      const result = await applyDescription(connection, description);
      assert.equal(result.success, true);
      assert.match(result.message, /Description verified/i);
      // validateOnly pass + real patch
      assert.equal(patches.length, 2);
      assert.match(patches[0], /Family-owned RV dealership/);
    } finally {
      restore();
    }
  });

  it("does not report failure when the verification read fails after a successful patch", async () => {
    const restore = mockGbpFetch({ profileReadFails: true });

    try {
      const result = await applyDescription(
        connection,
        "Family-owned RV dealership serving Dallas since 1998."
      );
      assert.equal(result.success, true);
      assert.match(result.message, /Description submitted — Google is processing/);
      assert.equal(result.applied?.verificationUnavailable, true);
      assert.equal(isGbpDescriptionLiveSync(result.message), true);
    } finally {
      restore();
    }
  });
});
