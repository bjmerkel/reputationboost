import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createCustomEditableHolidayPeriod,
  defaultEditableHolidayPeriods,
  defaultUsHolidayDescriptions,
  defaultUsHolidayHours,
  findEditableHolidayDateDuplicates,
  formatEditableHolidayDateInput,
  formatSpecialHoursSummary,
  hasAdequateHolidayCoverage,
  isEditableHolidayPeriodComplete,
  normalizeSpecialHoursForApi,
  parseEditableHolidayDateInput,
  parseEditableHolidayPeriods,
  specialHoursFromEditablePeriods,
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

  it("builds API special hours from editable holiday periods", () => {
    const periods = defaultEditableHolidayPeriods(2026).map((period) =>
      period.name === "Christmas Eve"
        ? { ...period, closed: false, openTime: "10:00", closeTime: "14:00" }
        : period.name === "New Year's Eve"
          ? { ...period, enabled: false }
          : period
    );

    const specialHours = specialHoursFromEditablePeriods(periods);
    const christmasEve = specialHours.specialHourPeriods?.find(
      (period) => period.startDate?.month === 12 && period.startDate?.day === 24
    );
    const newYearsEve = specialHours.specialHourPeriods?.find(
      (period) => period.startDate?.month === 12 && period.startDate?.day === 31
    );

    assert.deepEqual(christmasEve?.openTime, { hours: 10, minutes: 0 });
    assert.deepEqual(christmasEve?.closeTime, { hours: 14, minutes: 0 });
    assert.equal(newYearsEve, undefined);
    assert.equal(specialHours.specialHourPeriods?.length, 9);
  });

  it("falls back to defaults when holiday edits are invalid", () => {
    const parsed = parseEditableHolidayPeriods([{ name: "Bad row" }], 2026);
    assert.equal(parsed.length, 10);
    assert.equal(parsed[0]?.name, "New Year's Day");
  });

  it("keeps valid custom holiday edits when parsing mixed payloads", () => {
    const custom = {
      ...createCustomEditableHolidayPeriod(2026),
      name: "Company retreat",
      month: 3,
      day: 15,
    };
    const defaults = defaultEditableHolidayPeriods(2026);
    const parsed = parseEditableHolidayPeriods([...defaults, custom], 2026);

    assert.equal(parsed.length, 11);
    assert.equal(parsed.at(-1)?.name, "Company retreat");
    assert.equal(parsed.at(-1)?.custom, true);
  });

  it("includes complete custom special hours in API output", () => {
    const periods = [
      ...defaultEditableHolidayPeriods(2026).filter((period) => period.name === "New Year's Day"),
      {
        ...createCustomEditableHolidayPeriod(2026),
        name: "Inventory day",
        month: 6,
        day: 2,
        closed: false,
        openTime: "10:00",
        closeTime: "14:00",
      },
    ];

    const specialHours = specialHoursFromEditablePeriods(periods);
    const inventoryDay = specialHours.specialHourPeriods?.find(
      (period) => period.startDate?.month === 6 && period.startDate?.day === 2
    );

    assert.equal(specialHours.specialHourPeriods?.length, 2);
    assert.deepEqual(inventoryDay?.openTime, { hours: 10, minutes: 0 });
    assert.deepEqual(inventoryDay?.closeTime, { hours: 14, minutes: 0 });
  });

  it("skips incomplete custom special hours", () => {
    const periods = [
      {
        ...createCustomEditableHolidayPeriod(2026),
        name: "",
        enabled: true,
      },
    ];

    assert.equal(isEditableHolidayPeriodComplete(periods[0]!), false);
    assert.equal(specialHoursFromEditablePeriods(periods).specialHourPeriods?.length, 0);
  });

  it("detects duplicate editable holiday dates", () => {
    const periods = defaultEditableHolidayPeriods(2026);
    const duplicates = findEditableHolidayDateDuplicates([
      periods[0]!,
      { ...periods[0]!, custom: true, id: "dup", name: "Duplicate" },
    ]);

    assert.deepEqual(duplicates, ["2026-1-1"]);
  });

  it("parses editable holiday date input", () => {
    assert.deepEqual(parseEditableHolidayDateInput("2026-07-04"), {
      year: 2026,
      month: 7,
      day: 4,
    });
    assert.equal(parseEditableHolidayDateInput("2026-02-30"), null);
    assert.equal(formatEditableHolidayDateInput({ year: 2026, month: 7, day: 4 } as never), "2026-07-04");
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
