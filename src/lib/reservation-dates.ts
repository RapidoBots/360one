import { toZonedTime, fromZonedTime } from "date-fns-tz";

// Every function here takes an explicit IANA `timeZone` (Restaurant.timezone)
// rather than relying on the process's own local time -- Vercel always runs
// in UTC, which silently disagreed with restaurants/customers in any other
// zone (a widget booking made late at night could land on what the server
// considered a different calendar day, vanishing from the dashboard's
// default view). toZonedTime/fromZonedTime resolve the correct UTC offset
// for `timeZone` via Intl, independent of the process's own timezone.

export function getDayRange(date: Date, timeZone: string): { start: Date; end: Date } {
  const zoned = toZonedTime(date, timeZone);
  zoned.setHours(0, 0, 0, 0);
  const start = fromZonedTime(zoned, timeZone);
  const zonedEnd = new Date(zoned);
  zonedEnd.setDate(zonedEnd.getDate() + 1);
  const end = fromZonedTime(zonedEnd, timeZone);
  return { start, end };
}

export function getWeekRange(date: Date, timeZone: string): { start: Date; end: Date } {
  const zoned = toZonedTime(date, timeZone);
  zoned.setHours(0, 0, 0, 0);
  const day = zoned.getDay(); // 0 = Sunday ... 6 = Saturday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  zoned.setDate(zoned.getDate() + diffToMonday);
  const start = fromZonedTime(zoned, timeZone);
  const zonedEnd = new Date(zoned);
  zonedEnd.setDate(zonedEnd.getDate() + 7);
  const end = fromZonedTime(zonedEnd, timeZone);
  return { start, end };
}

// Replaces `date.toISOString().slice(0, 10)`, which converts to UTC first
// and silently shifts to the wrong calendar day near midnight in `timeZone`.
export function toLocalDateInput(date: Date, timeZone: string): string {
  const zoned = toZonedTime(date, timeZone);
  const year = zoned.getFullYear();
  const month = String(zoned.getMonth() + 1).padStart(2, "0");
  const day = String(zoned.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Returns the day-of-week (0 = Sunday ... 6 = Saturday) that `date` falls on
// as observed in `timeZone` -- for business-hours lookups against a stored
// (UTC) startsAt.
export function getZonedDayOfWeek(date: Date, timeZone: string): number {
  return toZonedTime(date, timeZone).getDay();
}

// Replaces `new Date(`${date}T${time}`)`, which parsed the wall-clock string
// using the process's own local timezone instead of the restaurant's.
export function zonedDateTimeToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  return fromZonedTime(`${dateStr}T${timeStr}`, timeZone);
}

// Returns the hour-of-day (0-23) that `date` falls on as observed in
// `timeZone` -- for hour-bucketed charts (Dashboard, Reports) against a
// stored (UTC) startsAt.
export function getZonedHour(date: Date, timeZone: string): number {
  return toZonedTime(date, timeZone).getHours();
}
