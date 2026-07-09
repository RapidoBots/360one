import { describe, expect, it } from "vitest";
import { getDayRange, getWeekRange } from "@/lib/reservation-dates";

describe("getDayRange", () => {
  it("returns midnight-to-midnight for the given date", () => {
    const { start, end } = getDayRange(new Date("2026-03-10T14:30:00"));
    expect(start.getHours()).toBe(0);
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });
});

describe("getWeekRange", () => {
  it("starts on Monday for a mid-week date", () => {
    const { start } = getWeekRange(new Date("2026-03-11T00:00:00")); // Wednesday
    expect(start.getDay()).toBe(1); // Monday
    expect(start.getDate()).toBe(9);
  });

  it("starts on the preceding Monday for a Sunday date", () => {
    const { start } = getWeekRange(new Date("2026-03-15T00:00:00")); // Sunday
    expect(start.getDay()).toBe(1);
    expect(start.getDate()).toBe(9);
  });

  it("spans exactly 7 days", () => {
    const { start, end } = getWeekRange(new Date("2026-03-11T00:00:00"));
    expect(end.getTime() - start.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
