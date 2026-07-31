import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countCsvDataRows,
  parseCustomerCsvChunk,
  validateCsvForImport,
} from "@/lib/customers/parse-import";

describe("validateCsvForImport", () => {
  it("accepts csv with phone column", () => {
    const result = validateCsvForImport("phone,first_name\n2145550100,Jane");
    assert.equal(result.ok, true);
  });

  it("rejects csv without contact columns", () => {
    const result = validateCsvForImport("first_name,service\nJane,oil change");
    assert.equal(result.ok, false);
  });
});

describe("countCsvDataRows", () => {
  it("counts data rows excluding header", () => {
    const csv = "phone,first_name\n2145550100,Jane\n2145550101,John";
    assert.equal(countCsvDataRows(csv), 2);
  });
});

describe("parseCustomerCsvChunk", () => {
  it("parses a chunk and reports progress", () => {
    const csv =
      "phone,first_name\n2145550100,Alice\n2145550101,Bob\n2145550102,Carol";
    const first = parseCustomerCsvChunk(csv, 0, 2);
    assert.equal(first.rows.length, 2);
    assert.equal(first.linesConsumed, 2);
    assert.equal(first.done, false);

    const second = parseCustomerCsvChunk(csv, first.linesConsumed, 2);
    assert.equal(second.rows.length, 1);
    assert.equal(second.done, true);
  });
});
