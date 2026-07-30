import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addDays,
  buildMonthCalendarCells,
  datetimeLocalValueToIso,
  defaultGooglePostScheduledFor,
  groupUpcomingGooglePostsByDate,
  googlePostAwaitingScheduledPublish,
  googlePostShouldScheduleOnly,
  isoToDatetimeLocalValue,
  isFutureScheduled,
  upcomingGooglePostTasks,
  validateGooglePostScheduleTime,
} from "./google-post-schedule";
import type { ExecutionTask } from "@/audit/types";

function googlePostTask(overrides: Partial<ExecutionTask> = {}): ExecutionTask {
  return {
    id: "task-1",
    auditId: "audit-1",
    actionItemId: "gbp-step-8",
    type: "google_post",
    title: "Step 8: Weekly Google Posts (1/4)",
    description: "Post weekly",
    priority: "medium",
    status: "pending_approval",
    draftContent: "Hello world",
    payload: { postIndex: 1, totalPosts: 4 },
    requiresApproval: true,
    scheduledFor: null,
    completedAt: null,
    result: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    planStepNumber: 8,
    planPhaseId: "growth",
    ...overrides,
  };
}

describe("google-post-schedule", () => {
  it("defaultGooglePostScheduledFor staggers by week number", () => {
    const from = new Date("2026-01-01T12:00:00.000Z");
    const week1 = defaultGooglePostScheduledFor(1, from);
    const week2 = defaultGooglePostScheduledFor(2, from);
    assert.equal(week1, addDays(from, 7).toISOString());
    assert.equal(week2, addDays(from, 14).toISOString());
  });

  it("isFutureScheduled detects future publish times", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const past = new Date(Date.now() - 60_000).toISOString();
    assert.equal(isFutureScheduled(future), true);
    assert.equal(isFutureScheduled(past), false);
    assert.equal(isFutureScheduled(null), false);
  });

  it("googlePostShouldScheduleOnly when post is scheduled in the future", () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const task = googlePostTask({ scheduledFor: future });
    assert.equal(googlePostShouldScheduleOnly(task), true);
    assert.equal(googlePostShouldScheduleOnly(task, true), false);
  });

  it("googlePostAwaitingScheduledPublish for approved future posts", () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const task = googlePostTask({ status: "approved", scheduledFor: future });
    assert.equal(googlePostAwaitingScheduledPublish(task), true);
    assert.equal(googlePostAwaitingScheduledPublish(googlePostTask()), false);
  });

  it("datetimeLocalValueToIso round-trips through picker helpers", () => {
    const iso = defaultGooglePostScheduledFor(2, new Date("2026-06-15T10:00:00.000Z"));
    const local = isoToDatetimeLocalValue(iso);
    assert.ok(local.length > 0);
    const parsed = datetimeLocalValueToIso(local);
    assert.ok(parsed);
    assert.equal(new Date(parsed).getTime(), new Date(iso).getTime());
  });

  it("validateGooglePostScheduleTime rejects near-term times", () => {
    const soon = new Date(Date.now() + 60_000).toISOString();
    assert.ok(validateGooglePostScheduleTime(soon));
  });

  it("upcomingGooglePostTasks sorts by scheduled time", () => {
    const later = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const sooner = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const upcoming = upcomingGooglePostTasks([
      googlePostTask({ id: "a", scheduledFor: later, status: "scheduled" }),
      googlePostTask({ id: "b", scheduledFor: sooner, status: "pending_approval" }),
    ]);
    assert.equal(upcoming[0]?.id, "b");
    assert.equal(upcoming[1]?.id, "a");
  });

  it("googlePostShouldScheduleOnly uses picker scheduledFor when task has none", () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const task = googlePostTask({ scheduledFor: null });
    assert.equal(googlePostShouldScheduleOnly(task, false, future), true);
    assert.equal(googlePostShouldScheduleOnly(task, false, null), false);
    assert.equal(googlePostShouldScheduleOnly(task, true, future), false);
  });

  it("buildMonthCalendarCells pads weeks and groups by local date", () => {
    const cells = buildMonthCalendarCells(2026, 6);
    assert.equal(cells.length % 7, 0);
    const grouped = groupUpcomingGooglePostsByDate([
      googlePostTask({
        id: "july",
        scheduledFor: "2026-07-15T15:00:00.000Z",
        status: "scheduled",
      }),
    ]);
    const keys = [...grouped.keys()];
    assert.equal(keys.length, 1);
    assert.ok(keys[0].startsWith("2026-07-"));
  });
});
