/** Max review asks per grid cell per rolling 7-day window. */
export const CELL_WEEKLY_SEND_CAP = 3;

export function isCellCapReached(sendsThisWeek: number): boolean {
  return sendsThisWeek >= CELL_WEEKLY_SEND_CAP;
}

export function cellCapRemaining(sendsThisWeek: number): number {
  return Math.max(0, CELL_WEEKLY_SEND_CAP - sendsThisWeek);
}
