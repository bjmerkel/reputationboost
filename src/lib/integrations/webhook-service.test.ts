import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FullAuditPayload } from "@/audit/types";
import { inferWebhookServiceNotes } from "./webhook-service";

function auditWithKeywords(): FullAuditPayload {
  return {
    rankings: {
      keywords: [{ keyword: "after school programs las vegas" }],
    },
    strategy: {
      gbpPlan: {
        targetKeywords: ["after school programs las vegas", "tutoring las vegas"],
      },
    },
  } as FullAuditPayload;
}

describe("inferWebhookServiceNotes", () => {
  it("maps Jobber job type to matching audit keyword", () => {
    const service = inferWebhookServiceNotes(
      { jobType: "After School Enrichment Program" },
      auditWithKeywords()
    );
    assert.equal(service, "after school programs las vegas");
  });

  it("falls back to raw service text when no keyword match", () => {
    const service = inferWebhookServiceNotes(
      { service: "Window cleaning" },
      auditWithKeywords()
    );
    assert.equal(service, "Window cleaning");
  });
});
