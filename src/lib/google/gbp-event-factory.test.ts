import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPubSubGbpEvent,
  eventTypeFromNotificationType,
  planLinkForEventType,
  severityForEventType,
} from "./gbp-event-factory";

describe("gbp-event-factory", () => {
  it("maps notification types to event types", () => {
    assert.equal(eventTypeFromNotificationType("GOOGLE_UPDATE"), "GOOGLE_UPDATE");
    assert.equal(eventTypeFromNotificationType("NEW_CUSTOMER_MEDIA"), "NEW_CUSTOMER_MEDIA");
    assert.equal(eventTypeFromNotificationType("UNKNOWN"), null);
  });

  it("assigns severity by event type", () => {
    assert.equal(severityForEventType("DUPLICATE_LOCATION"), "critical");
    assert.equal(severityForEventType("NEW_REVIEW"), "info");
  });

  it("links google update events to step 0", () => {
    const plan = planLinkForEventType("GOOGLE_UPDATE");
    assert.equal(plan.planStepNumber, 0);
    assert.equal(plan.planScrollTarget, "google-updates");
  });

  it("escalates negative reviews from pubsub", () => {
    const event = buildPubSubGbpEvent({
      businessId: "biz-1",
      userId: "user-1",
      notificationType: "NEW_REVIEW",
      eventId: "evt-1",
      reviewRating: 2,
      reviewAuthor: "Alex",
    });

    assert.ok(event);
    assert.equal(event?.eventType, "NEGATIVE_REVIEW");
    assert.equal(event?.planStepNumber, 11);
    assert.equal(event?.externalId, "pubsub:evt-1");
  });
});
