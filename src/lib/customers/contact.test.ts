import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeCustomerContact } from "@/lib/customers/contact";
import { parseCustomerCsv } from "@/lib/customers/parse-import";

describe("normalizeCustomerContact", () => {
  it("accepts phone only", () => {
    const contact = normalizeCustomerContact({ phone: "214-555-0100" });
    assert.equal(contact.phone, "+12145550100");
    assert.equal(contact.email, null);
  });

  it("accepts email only", () => {
    const contact = normalizeCustomerContact({ email: "Jane@Example.com" });
    assert.equal(contact.phone, null);
    assert.equal(contact.email, "jane@example.com");
  });

  it("requires at least one contact method", () => {
    assert.throws(() => normalizeCustomerContact({}), /Phone or email is required/);
  });
});

describe("parseCustomerCsv email-only rows", () => {
  it("imports rows with email but no phone", () => {
    const csv = `first_name,last_name,email,service
Jane,Doe,jane@example.com,AC repair`;
    const { rows, errors } = parseCustomerCsv(csv);
    assert.equal(errors.length, 0);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].email, "jane@example.com");
    assert.equal(rows[0].phone, undefined);
  });

  it("requires phone or email column", () => {
    const { errors } = parseCustomerCsv("first_name,service\nJane,AC");
    assert.ok(errors.some((error) => error.includes("phone or email")));
  });
});
