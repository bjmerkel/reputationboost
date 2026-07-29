import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ZAPIER_CONTACT_FIELDS,
  ZAPIER_TEMPLATES,
  withZapierContactFields,
} from "@/lib/integrations/zapier-templates";

describe("withZapierContactFields", () => {
  it("always includes phone and email first", () => {
    assert.deepEqual(withZapierContactFields(["service", "amount"]), [
      "phone",
      "email",
      "service",
      "amount",
    ]);
  });

  it("deduplicates contact fields when already present", () => {
    assert.deepEqual(withZapierContactFields(["email", "phone", "service"]), [
      "phone",
      "email",
      "service",
    ]);
  });
});

describe("ZAPIER_TEMPLATES", () => {
  it("includes phone and email for every integration", () => {
    for (const template of ZAPIER_TEMPLATES) {
      assert.ok(
        template.sampleFields.includes("phone"),
        `${template.id} is missing phone`
      );
      assert.ok(
        template.sampleFields.includes("email"),
        `${template.id} is missing email`
      );
      assert.deepEqual(
        template.sampleFields.slice(0, ZAPIER_CONTACT_FIELDS.length),
        [...ZAPIER_CONTACT_FIELDS],
        `${template.id} should list phone and email first`
      );
    }
  });
});
