import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultUsHolidayDescriptions,
  defaultUsHolidayHours,
  formatSpecialHoursSummary,
  hasAdequateHolidayCoverage,
  thanksgivingDay,
} from "./gbp-hours";

describe("gbp-hours", () => {
  it("computes Thanksgiving as the fourth Thursday in November", () => {
    assert.equal(thanksgivingDay(2026), 26);
    assert.equal(thanksgivingDay(2025), 27);
  });

  it("includes major US holidays for the year", () => {
    const holidays = defaultUsHolidayHours(2026);
    assert.equal(holidays.specialHourPeriods?.length, 10);
    assert.ok(
      holidays.specialHourPeriods?.some(
        (period) =>
          period.startDate?.month === 11 &&
          period.startDate?.day === 26 &&
          period.isClosed === true
      )
    );
  });

  it("formats special hours with readable dates", () => {
    const summary = formatSpecialHoursSummary({
      specialHourPeriods: [
        {
          startDate: { year: 2026, month: 7, day: 4 },
          endDate: { year: 2026, month: 7, day: 4 },
          isClosed: true,
        },
      ],
    });

    assert.match(summary, /Jul 4: closed/);
  });

  it("treats a single special period as inadequate holiday coverage", () => {
    const specialHours = {
      specialHourPeriods: [
        {
          startDate: { year: 2026, month: 12, day: 25 },
          endDate: { year: 2026, month: 12, day: 25 },
          isClosed: true,
        },
      ],
    };

    assert.equal(hasAdequateHolidayCoverage(specialHours, 2026), false);
  });

  it("accepts profiles with most recommended holidays configured", () => {
    const holidays = defaultUsHolidayHours(2026);
    assert.equal(hasAdequateHolidayCoverage(holidays, 2026), true);
  });

  it("provides human-readable holiday descriptions for the plan UI", () => {
    const descriptions = defaultUsHolidayDescriptions(2026);
    assert.equal(descriptions.length, 10);
    assert.equal(descriptions[0]?.name, "New Year's Day");
    assert.equal(descriptions[6]?.name, "Thanksgiving");
  });
});
