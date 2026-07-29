import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSmsPreferenceReply } from "./opt-out-keywords";

describe("parseSmsPreferenceReply", () => {
  it("detects STOP replies", () => {
    assert.equal(parseSmsPreferenceReply("STOP"), "opt_out");
    assert.equal(parseSmsPreferenceReply("stop please"), "opt_out");
    assert.equal(parseSmsPreferenceReply("UNSUBSCRIBE"), "opt_out");
  });

  it("detects START replies", () => {
    assert.equal(parseSmsPreferenceReply("START"), "opt_in");
    assert.equal(parseSmsPreferenceReply("yes"), "opt_in");
  });

  it("ignores unrelated messages", () => {
    assert.equal(parseSmsPreferenceReply("Thanks!"), null);
    assert.equal(parseSmsPreferenceReply(""), null);
  });
});
