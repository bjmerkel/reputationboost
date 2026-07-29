import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RECOMMENDED_NOTIFICATION_TYPES, getGbpPubsubTopic } from "./gbp-notifications";

describe("getGbpPubsubTopic", () => {
  it("reads GBP_PUBSUB_TOPIC from the environment", () => {
    const previous = process.env.GBP_PUBSUB_TOPIC;
    process.env.GBP_PUBSUB_TOPIC = "projects/demo/topics/gbp";
    assert.equal(getGbpPubsubTopic(), "projects/demo/topics/gbp");
    process.env.GBP_PUBSUB_TOPIC = previous;
  });
});

describe("RECOMMENDED_NOTIFICATION_TYPES", () => {
  it("includes review, edit, media, and VOM alerts", () => {
    assert.ok(RECOMMENDED_NOTIFICATION_TYPES.includes("NEW_REVIEW"));
    assert.ok(RECOMMENDED_NOTIFICATION_TYPES.includes("UPDATED_REVIEW"));
    assert.ok(RECOMMENDED_NOTIFICATION_TYPES.includes("GOOGLE_UPDATE"));
    assert.ok(RECOMMENDED_NOTIFICATION_TYPES.includes("NEW_CUSTOMER_MEDIA"));
    assert.ok(RECOMMENDED_NOTIFICATION_TYPES.includes("VOICE_OF_MERCHANT_UPDATED"));
    assert.ok(!RECOMMENDED_NOTIFICATION_TYPES.includes("NEW_QUESTION"));
  });
});
