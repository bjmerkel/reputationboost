import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultUsHolidayDescriptions,
  defaultUsHolidayHours,
  formatSpecialHoursSummary,
  hasAdequateHolidayCoverage,
  normalizeSpecialHoursForApi,
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
          period.closed === true
      )
    );
  });

  it("formats special hours with readable dates", () => {
    const summary = formatSpecialHoursSummary({
      specialHourPeriods: [
        {
          startDate: { year: 2026, month: 7, day: 4 },
          endDate: { year: 2026, month: 7, day: 4 },
          closed: true,
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
          closed: true,
        },
      ],
    };

    assert.equal(hasAdequateHolidayCoverage(specialHours, 2026), false);
  });

  it("accepts profiles with most recommended holidays configured", () => {
    const holidays = defaultUsHolidayHours(2026);
    assert.equal(hasAdequateHolidayCoverage(holidays, 2026), true);
  });

  it("normalizes special hours to Business Information API v1 shape", () => {
    const normalized = normalizeSpecialHoursForApi(defaultUsHolidayHours(2026));
    const christmasEve = normalized.specialHourPeriods?.find(
      (period) => period.startDate?.month === 12 && period.startDate?.day === 24
    );
    const newYearsDay = normalized.specialHourPeriods?.find(
      (period) => period.startDate?.month === 1 && period.startDate?.day === 1
    );

    assert.equal(newYearsDay?.closed, true);
    assert.equal(newYearsDay?.isClosed, undefined);
    assert.deepEqual(christmasEve?.openTime, { hours: 11, minutes: 0 });
    assert.deepEqual(christmasEve?.closeTime, { hours: 15, minutes: 0 });
    assert.equal(christmasEve?.closed, false);
  });

  it("accepts legacy isClosed values when reading older payloads", () => {
    const summary = formatSpecialHoursSummary({
      specialHourPeriods: [
        {
          startDate: { year: 2026, month: 12, day: 25 },
          isClosed: true,
        },
      ],
    });

    assert.match(summary, /Dec 25: closed/);
  });
});
