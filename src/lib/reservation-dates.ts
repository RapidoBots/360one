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

// Same reasoning as toLocalDateInput, for the HH:mm half of a stored (UTC)
// startsAt -- e.g. to pre-fill a <input type="time"> with the restaurant's
// wall-clock time rather than the server's.
export function toLocalTimeInput(date: Date, timeZone: string): string {
  const zoned = toZonedTime(date, timeZone);
  const hours = String(zoned.getHours()).padStart(2, "0");
  const minutes = String(zoned.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
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

// Formats a stored (UTC) Date as the restaurant's local wall-clock time
// (e.g. "6:30 PM") -- same reasoning as toLocalDateInput/toLocalTimeInput,
// for the Reservations calendar's Day/Week/Timeline views and details panel.
export function formatZonedTime(date: Date, timeZone: string): string {
  const zoned = toZonedTime(date, timeZone);
  const h24 = zoned.getHours();
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(zoned.getMinutes()).padStart(2, "0")} ${period}`;
}

// Same as above, for a human-readable calendar date (e.g. "Friday, July 10").
export function formatZonedDate(
  date: Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions
): string {
  return toZonedTime(date, timeZone).toLocaleDateString([], options);
}
