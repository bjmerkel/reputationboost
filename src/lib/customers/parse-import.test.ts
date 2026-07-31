import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { enforceImportRowLimit, parseCustomerCsv } from "@/lib/customers/parse-import";
import { MAX_CSV_ROWS } from "@/lib/review-requests/bulk-config";

describe("enforceImportRowLimit", () => {
  it("allows imports within the cap", () => {
    assert.equal(enforceImportRowLimit(MAX_CSV_ROWS), null);
    assert.equal(enforceImportRowLimit(100), null);
  });

  it("rejects imports above the cap", () => {
    const error = enforceImportRowLimit(MAX_CSV_ROWS + 1);
    assert.ok(error?.includes(MAX_CSV_ROWS.toLocaleString()));
  });
});

describe("parseCustomerCsv", () => {
  it("parses phone and email columns", () => {
    const csv = "first_name,phone,email\nJane,(214) 555-0100,jane@example.com";
    const result = parseCustomerCsv(csv);
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].firstName, "Jane");
    assert.equal(result.rows[0].phone, "+12145550100");
    assert.equal(result.rows[0].email, "jane@example.com");
  });
});
