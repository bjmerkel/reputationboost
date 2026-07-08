/** Business Information API hour shapes and helpers. */

export type DayOfWeek =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export interface TimeOfDay {
  hours?: number;
  minutes?: number;
}

export interface TimePeriod {
  openDay?: DayOfWeek | string;
  closeDay?: DayOfWeek | string;
  openTime?: TimeOfDay | string;
  closeTime?: TimeOfDay | string;
}

export interface BusinessHours {
  periods?: TimePeriod[];
}

export interface SpecialHourPeriod {
  startDate?: { year?: number; month?: number; day?: number };
  endDate?: { year?: number; month?: number; day?: number };
  openTime?: TimeOfDay | string;
  closeTime?: TimeOfDay | string;
  isClosed?: boolean;
}

export interface SpecialHours {
  specialHourPeriods?: SpecialHourPeriod[];
}

const WEEKDAYS: DayOfWeek[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

const MONTH_NAMES = [
  "",
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function normalizeTime(value: TimeOfDay | string | undefined): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  const h = value.hours ?? 0;
  const m = value.minutes ?? 0;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function periodDateKey(period: SpecialHourPeriod): string {
  const { year, month, day } = period.startDate ?? {};
  return `${year ?? 0}-${month ?? 0}-${day ?? 0}`;
}

/** Nth weekday of a month (weekday: 0=Sun … 6=Sat). */
export function nthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  n: number
): number {
  const date = new Date(year, month - 1, 1);
  let count = 0;
  while (date.getMonth() === month - 1) {
    if (date.getDay() === weekday) {
      count += 1;
      if (count === n) return date.getDate();
    }
    date.setDate(date.getDate() + 1);
  }
  return 1;
}

/** Last weekday of a month (weekday: 0=Sun … 6=Sat). */
export function lastWeekdayOfMonth(year: number, month: number, weekday: number): number {
  const date = new Date(year, month, 0);
  while (date.getDay() !== weekday) {
    date.setDate(date.getDate() - 1);
  }
  return date.getDate();
}

export function thanksgivingDay(year: number): number {
  return nthWeekdayOfMonth(year, 11, 4, 4);
}

/** Count distinct days with open periods in regular hours. */
export function countOpenDays(regularHours?: BusinessHours | null): number {
  const days = new Set<string>();
  for (const period of regularHours?.periods ?? []) {
    if (period.openDay) days.add(String(period.openDay));
  }
  return days.size;
}

export function hasFullWeekCoverage(regularHours?: BusinessHours | null, minDays = 5): boolean {
  return countOpenDays(regularHours) >= minDays;
}

export function hasSpecialHourPeriods(specialHours?: SpecialHours | null): boolean {
  return (specialHours?.specialHourPeriods?.length ?? 0) > 0;
}

export function recommendedHolidayPeriodCount(year = new Date().getFullYear()): number {
  return defaultUsHolidayHours(year).specialHourPeriods?.length ?? 0;
}

/** True when the profile has most major US holidays configured for the year. */
export function hasAdequateHolidayCoverage(
  specialHours?: SpecialHours | null,
  year = new Date().getFullYear()
): boolean {
  const configured = specialHours?.specialHourPeriods ?? [];
  if (configured.length === 0) return false;

  const recommended = defaultUsHolidayHours(year).specialHourPeriods ?? [];
  const configuredKeys = new Set(configured.map(periodDateKey));
  const covered = recommended.filter((period) =>
    configuredKeys.has(periodDateKey(period))
  ).length;

  const minimum = Math.max(6, Math.ceil(recommended.length * 0.75));
  return covered >= minimum;
}

export function formatRegularHoursSummary(regularHours?: BusinessHours | null): string {
  const periods = regularHours?.periods ?? [];
  if (periods.length === 0) return "No regular hours set";

  return periods
    .map((period) => {
      const day = String(period.openDay ?? "").slice(0, 3);
      const open = normalizeTime(period.openTime);
      const close = normalizeTime(period.closeTime);
      return `${day} ${open}-${close}`.trim();
    })
    .join(", ");
}

export function formatSpecialHourPeriod(period: SpecialHourPeriod): string {
  const month = period.startDate?.month;
  const day = period.startDate?.day;
  if (!month || !day) return "Unknown date";

  const label = `${MONTH_NAMES[month]} ${day}`;
  if (period.isClosed) return `${label}: closed`;

  const open = normalizeTime(period.openTime);
  const close = normalizeTime(period.closeTime);
  if (open && close) return `${label}: ${open}–${close}`;
  return label;
}

export function formatSpecialHoursSummary(specialHours?: SpecialHours | null): string {
  const periods = specialHours?.specialHourPeriods ?? [];
  if (periods.length === 0) return "No holiday or special hours";

  const labels = periods.slice(0, 4).map(formatSpecialHourPeriod);
  const remaining = periods.length - labels.length;
  if (remaining > 0) {
    return `${labels.join(" · ")} · +${remaining} more`;
  }
  return labels.join(" · ");
}

export function listHolidayPeriodLabels(
  specialHours: SpecialHours,
  options?: { year?: number; labelForPeriod?: (period: SpecialHourPeriod) => string }
): string[] {
  const labelForPeriod = options?.labelForPeriod ?? formatSpecialHourPeriod;
  return (specialHours.specialHourPeriods ?? []).map(labelForPeriod);
}

/** Default Mon–Fri 9:00–17:00 when a location has no regular hours yet. */
export function defaultWeekdayHours(): BusinessHours {
  return {
    periods: WEEKDAYS.slice(0, 5).map((day) => ({
      openDay: day,
      closeDay: day,
      openTime: { hours: 9, minutes: 0 },
      closeTime: { hours: 17, minutes: 0 },
    })),
  };
}

function datePeriod(
  year: number,
  month: number,
  day: number,
  closed: boolean,
  open?: string,
  close?: string
): SpecialHourPeriod {
  const period: SpecialHourPeriod = {
    startDate: { year, month, day },
    endDate: { year, month, day },
    isClosed: closed,
  };
  if (!closed && open && close) {
    period.openTime = open;
    period.closeTime = close;
  }
  return period;
}

/** Major US holidays + common retail closures for the given year. */
export function defaultUsHolidayHours(year = new Date().getFullYear()): SpecialHours {
  return {
    specialHourPeriods: [
      datePeriod(year, 1, 1, true),
      datePeriod(year, 1, nthWeekdayOfMonth(year, 1, 1, 3), true),
      datePeriod(year, 5, lastWeekdayOfMonth(year, 5, 1), true),
      datePeriod(year, 7, 4, true),
      datePeriod(year, 9, nthWeekdayOfMonth(year, 9, 1, 1), true),
      datePeriod(year, 11, 11, true),
      datePeriod(year, 11, thanksgivingDay(year), true),
      datePeriod(year, 12, 24, false, "11:00", "15:00"),
      datePeriod(year, 12, 25, true),
      datePeriod(year, 12, 31, false, "11:00", "17:00"),
    ],
  };
}

const DEFAULT_HOLIDAY_NAMES = [
  "New Year's Day",
  "Martin Luther King Jr. Day",
  "Memorial Day",
  "Independence Day",
  "Labor Day",
  "Veterans Day",
  "Thanksgiving",
  "Christmas Eve",
  "Christmas Day",
  "New Year's Eve",
];

export function defaultUsHolidayDescriptions(
  year = new Date().getFullYear()
): Array<{ name: string; schedule: string; period: SpecialHourPeriod }> {
  const periods = defaultUsHolidayHours(year).specialHourPeriods ?? [];
  return periods.map((period, index) => ({
    name: DEFAULT_HOLIDAY_NAMES[index] ?? formatSpecialHourPeriod(period),
    schedule: period.isClosed
      ? "Closed"
      : `${normalizeTime(period.openTime)} – ${normalizeTime(period.closeTime)}`,
    period,
  }));
}

export function mergeSpecialHours(
  existing: SpecialHours | null | undefined,
  additions: SpecialHours
): SpecialHours {
  const current = existing?.specialHourPeriods ?? [];
  const seen = new Set(current.map(periodDateKey));

  const merged = [...current];
  for (const period of additions.specialHourPeriods ?? []) {
    const key = periodDateKey(period);
    if (!seen.has(key)) {
      merged.push(period);
      seen.add(key);
    }
  }

  return { specialHourPeriods: merged };
}
