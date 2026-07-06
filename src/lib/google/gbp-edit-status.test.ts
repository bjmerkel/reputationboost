import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkGbpDescriptionEditStatus,
  editStatusFromPayload,
  editStatusIsFailure,
  editStatusResultMessage,
  resolveDescriptionEditStatus,
  type GbpEditStatusResult,
} from "./gbp-edit-status";
import { isGbpDescriptionLiveSync, needsGbpDescriptionRepublish } from "./gbp-description";

const SENT = "Family-owned RV dealership serving Dallas since 1998.";

describe("resolveDescriptionEditStatus", () => {
  it("reports accepted when the live description matches what was sent", () => {
    const result = resolveDescriptionEditStatus({ sentText: SENT, liveText: SENT });
    assert.equal(result.status, "accepted");
    assert.equal(result.label, "Accepted");
  });

  it("reports pending while profile.description is in Google's pendingMask", () => {
    const result = resolveDescriptionEditStatus({
      sentText: SENT,
      liveText: "old description",
      pendingMask: "profile.description",
    });
    assert.equal(result.status, "pending");
    assert.match(result.detail, /10 minutes/);
    assert.match(result.detail, /30 days/);
  });

  it("reports conflict when Google serves its own value via diffMask", () => {
    const result = resolveDescriptionEditStatus({
      sentText: SENT,
      liveText: "google's version",
      diffMask: "profile.description",
    });
    assert.equal(result.status, "conflict");
    assert.match(result.detail, /Google Updates/);
  });

  it("reports not approved when review finished but the edit is not live", () => {
    const result = resolveDescriptionEditStatus({
      sentText: SENT,
      liveText: "old description",
      pendingMask: "",
      diffMask: "",
    });
    assert.equal(result.status, "not_approved");
    assert.match(result.detail, /appeal/i);
  });

  it("reports unknown without published text to compare", () => {
    const result = resolveDescriptionEditStatus({ sentText: "", liveText: "anything" });
    assert.equal(result.status, "unknown");
  });
});

describe("editStatusResultMessage", () => {
  function fakeResult(status: GbpEditStatusResult["status"]): GbpEditStatusResult {
    return {
      status,
      label: status,
      detail: "detail",
      liveText: "",
      checkedAt: new Date().toISOString(),
    };
  }

  it("accepted and pending messages count as live-synced (no republish nag)", () => {
    for (const status of ["accepted", "pending"] as const) {
      const message = editStatusResultMessage(fakeResult(status));
      assert.equal(isGbpDescriptionLiveSync(message), true, `status ${status}`);
      assert.equal(
        needsGbpDescriptionRepublish({
          type: "gbp_description",
          status: "completed",
          result: message,
        }),
        false
      );
    }
  });

  it("not approved and conflict are failures that trigger the republish flow", () => {
    for (const status of ["not_approved", "conflict"] as const) {
      assert.equal(editStatusIsFailure(status), true);
      const message = editStatusResultMessage(fakeResult(status));
      assert.equal(
        needsGbpDescriptionRepublish({
          type: "gbp_description",
          status: "failed",
          result: message,
        }),
        true
      );
    }
  });
});

describe("editStatusFromPayload", () => {
  it("round-trips a stored edit status", () => {
    const stored = editStatusFromPayload({
      editStatus: {
        status: "pending",
        label: "Pending",
        detail: "Under review",
        checkedAt: "2026-07-06T22:00:00.000Z",
      },
    });
    assert.equal(stored?.status, "pending");
    assert.equal(stored?.label, "Pending");
  });

  it("returns null for tasks without a stored status", () => {
    assert.equal(editStatusFromPayload({}), null);
    assert.equal(editStatusFromPayload(undefined), null);
  });
});

describe("checkGbpDescriptionEditStatus", () => {
  const connection = {
    businessId: "b1",
    accountId: "a1",
    locationId: "123",
    accessToken: "fake-token",
    refreshToken: "refresh",
    expiresAt: new Date().toISOString(),
  };

  function mockFetch(options: { liveDescription: string; pendingMask?: string; diffMask?: string }) {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith(":getGoogleUpdated")) {
        return new Response(
          JSON.stringify({
            location: {},
            pendingMask: options.pendingMask ?? "",
            diffMask: options.diffMask ?? "",
          }),
          { status: 200 }
        );
      }
      return new Response(
        JSON.stringify({
          name: "locations/123",
          profile: { description: options.liveDescription },
          metadata: {},
        }),
        { status: 200 }
      );
    }) as typeof fetch;
    return () => {
      globalThis.fetch = originalFetch;
    };
  }

  it("returns accepted when Google serves the published text", async () => {
    const restore = mockFetch({ liveDescription: SENT });
    try {
      const result = await checkGbpDescriptionEditStatus(connection, SENT);
      assert.equal(result.status, "accepted");
      assert.equal(result.liveText, SENT);
    } finally {
      restore();
    }
  });

  it("returns pending while the field is still processing", async () => {
    const restore = mockFetch({
      liveDescription: "old text",
      pendingMask: "profile.description",
    });
    try {
      const result = await checkGbpDescriptionEditStatus(connection, SENT);
      assert.equal(result.status, "pending");
    } finally {
      restore();
    }
  });

  it("compares against the sanitized version of the draft", async () => {
    // The draft contains a phone number that was stripped at publish time —
    // the live text on Google matches the sanitized form, so it's accepted.
    const draft = `${SENT} Call us at (703) 820-5400 to schedule!`;
    const sanitizedLive = `${SENT} Call us to schedule!`;
    const restore = mockFetch({ liveDescription: sanitizedLive });
    try {
      const result = await checkGbpDescriptionEditStatus(connection, draft);
      assert.equal(result.status, "accepted");
    } finally {
      restore();
    }
  });
});
