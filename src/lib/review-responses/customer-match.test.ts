import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  customerServiceMatchesKeyword,
  findCustomerForReviewer,
} from "./customer-match";

describe("customer-match", () => {
  const customers = [
    {
      first_name: "Jane",
      last_name: "Doe",
      service_notes: "oil change and tire rotation",
    },
  ];

  it("matches reviewer to customer record", () => {
    const customer = findCustomerForReviewer("Jane Doe", customers);
    assert.equal(customer?.service_notes, "oil change and tire rotation");
  });

  it("detects keyword overlap from service notes", () => {
    assert.equal(
      customerServiceMatchesKeyword("Jane Doe", "oil change arlington va", customers),
      true
    );
    assert.equal(
      customerServiceMatchesKeyword("Jane Doe", "transmission repair", customers),
      false
    );
  });
});
