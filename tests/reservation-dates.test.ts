import { describe, expect, it } from "vitest";
import {
  getDayRange,
  getWeekRange,
  toLocalDateInput,
  getZonedDayOfWeek,
  zonedDateTimeToUtc,
} from "@/lib/reservation-dates";

const TZ = "America/Toronto"; // UTC-4 (EDT) in July, UTC-5 (EST) in January

describe("getDayRange", () => {
  it("returns midnight-to-midnight in the given timezone", () => {
    const { start, end } = getDayRange(new Date("2026-03-10T14:30:00Z"), TZ);
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
    expect(getZonedDayOfWeek(start, TZ)).toBe(getZonedDayOfWeek(new Date("2026-03-10T14:30:00Z"), TZ));
  });

  it("computes the correct UTC instant for local midnight in a non-UTC zone", () => {
    // March 10 2026 is EDT (UTC-4) in America/Toronto -- local midnight is 04:00 UTC.
    const { start } = getDayRange(new Date("2026-03-10T14:30:00Z"), TZ);
    expect(start.toISOString()).toBe("2026-03-10T04:00:00.000Z");
  });
});

describe("getWeekRange", () => {
  it("starts on Monday for a mid-week date", () => {
    const { start } = getWeekRange(new Date("2026-03-11T12:00:00Z"), TZ); // Wednesday in Toronto
    expect(getZonedDayOfWeek(start, TZ)).toBe(1); // Monday
    expect(toLocalDateInput(start, TZ)).toBe("2026-03-09");
  });

  it("starts on the preceding Monday for a Sunday date", () => {
    const { start } = getWeekRange(new Date("2026-03-15T12:00:00Z"), TZ); // Sunday in Toronto
    expect(getZonedDayOfWeek(start, TZ)).toBe(1);
    expect(toLocalDateInput(start, TZ)).toBe("2026-03-09");
  });

  it("spans exactly 7 days", () => {
    const { start, end } = getWeekRange(new Date("2026-03-11T12:00:00Z"), TZ);
    expect(end.getTime() - start.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe("toLocalDateInput", () => {
  it("returns the calendar date as observed in the given timezone, not UTC's", () => {
    // 00:22 in America/Toronto (UTC-4 in July) is 04:22 UTC the same day --
    // but a positive-offset zone would fall on the previous UTC day, which
    // is exactly the case `date.toISOString().slice(0, 10)` gets wrong.
    const instant = new Date("2026-07-10T04:22:00Z");
    expect(toLocalDateInput(instant, TZ)).toBe("2026-07-10");
  });

  it("pads single-digit months and days", () => {
    expect(toLocalDateInput(new Date("2026-01-05T12:00:00Z"), TZ)).toBe("2026-01-05");
  });
});

describe("zonedDateTimeToUtc", () => {
  it("interprets the date/time strings as wall-clock values in the given zone", () => {
    // 19:00 in America/Toronto on July 24 2026 (EDT, UTC-4) is 23:00 UTC.
    const result = zonedDateTimeToUtc("2026-07-24", "19:00", TZ);
    expect(result.toISOString()).toBe("2026-07-24T23:00:00.000Z");
  });

  it("accounts for DST -- same wall-clock time in winter shifts by an extra hour", () => {
    // 19:00 in America/Toronto on January 24 2026 (EST, UTC-5) is 00:00 UTC the next day.
    const result = zonedDateTimeToUtc("2026-01-24", "19:00", TZ);
    expect(result.toISOString()).toBe("2026-01-25T00:00:00.000Z");
  });
});

describe("getZonedDayOfWeek", () => {
  it("returns the day-of-week as observed in the given timezone", () => {
    // 2026-03-10T14:30:00Z is 10:30 local in America/Toronto (EDT, UTC-4) --
    // same calendar day, a Tuesday.
    expect(getZonedDayOfWeek(new Date("2026-03-10T14:30:00Z"), TZ)).toBe(2); // Tuesday
  });
});
