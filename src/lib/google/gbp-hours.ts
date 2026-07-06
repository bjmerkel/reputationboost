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

function normalizeTime(value: TimeOfDay | string | undefined): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  const h = value.hours ?? 0;
  const m = value.minutes ?? 0;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
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

export function formatSpecialHoursSummary(specialHours?: SpecialHours | null): string {
  const periods = specialHours?.specialHourPeriods ?? [];
  if (periods.length === 0) return "No holiday or special hours";

  return `${periods.length} special period${periods.length === 1 ? "" : "s"} configured`;
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

/** US federal holidays + common retail closures for the given year. */
export function defaultUsHolidayHours(year = new Date().getFullYear()): SpecialHours {
  return {
    specialHourPeriods: [
      datePeriod(year, 1, 1, true),
      datePeriod(year, 7, 4, true),
      datePeriod(year, 11, 11, true),
      datePeriod(year, 11, 28, true),
      datePeriod(year, 12, 24, false, "11:00", "15:00"),
      datePeriod(year, 12, 25, true),
      datePeriod(year, 12, 31, false, "11:00", "17:00"),
    ],
  };
}

export function mergeSpecialHours(
  existing: SpecialHours | null | undefined,
  additions: SpecialHours
): SpecialHours {
  const current = existing?.specialHourPeriods ?? [];
  const seen = new Set(
    current.map(
      (p) =>
        `${p.startDate?.year}-${p.startDate?.month}-${p.startDate?.day}`
    )
  );

  const merged = [...current];
  for (const period of additions.specialHourPeriods ?? []) {
    const key = `${period.startDate?.year}-${period.startDate?.month}-${period.startDate?.day}`;
    if (!seen.has(key)) {
      merged.push(period);
      seen.add(key);
    }
  }

  return { specialHourPeriods: merged };
}
