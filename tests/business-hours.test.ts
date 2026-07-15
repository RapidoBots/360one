import { describe, expect, it } from "vitest";
import { getHoursForDay, getWidestOpenWindow, type DayHours } from "@/lib/business-hours";

describe("getHoursForDay", () => {
  it("defaults to open 7am-11pm when no row exists for that day", () => {
    const result = getHoursForDay([], 1);
    expect(result).toEqual({ isOpen: true, startHour: 7, endHour: 23 });
  });

  it("returns closed when the day's row says isOpen: false", () => {
    const hours: DayHours[] = [{ dayOfWeek: 1, isOpen: false, openTime: null, closeTime: null }];
    const result = getHoursForDay(hours, 1);
    expect(result.isOpen).toBe(false);
  });

  it("returns a custom configured window for an open day", () => {
    const hours: DayHours[] = [{ dayOfWeek: 1, isOpen: true, openTime: "09:00", closeTime: "17:00" }];
    const result = getHoursForDay(hours, 1);
    expect(result).toEqual({ isOpen: true, startHour: 9, endHour: 17 });
  });

  it("only looks at the requested day, ignoring rows for other days", () => {
    const hours: DayHours[] = [
      { dayOfWeek: 1, isOpen: true, openTime: "09:00", closeTime: "17:00" },
      { dayOfWeek: 2, isOpen: false, openTime: null, closeTime: null },
    ];
    expect(getHoursForDay(hours, 2).isOpen).toBe(false);
    expect(getHoursForDay(hours, 3)).toEqual({ isOpen: true, startHour: 7, endHour: 23 });
  });
});

describe("getWidestOpenWindow", () => {
  it("defaults to 7am-11pm when no rows exist", () => {
    expect(getWidestOpenWindow([])).toEqual({ startHour: 7, endHour: 23 });
  });

  it("unions the widest start and end across every open day", () => {
    const hours: DayHours[] = [
      { dayOfWeek: 1, isOpen: true, openTime: "08:00", closeTime: "16:00" },
      { dayOfWeek: 6, isOpen: true, openTime: "10:00", closeTime: "23:00" },
    ];
    // Days without a row (Sun, Tue-Fri) default to open 7-23, which is wider
    // on the start side than Monday's 08:00 -- the widest window across all
    // 7 days, not just the two explicitly configured ones.
    expect(getWidestOpenWindow(hours)).toEqual({ startHour: 7, endHour: 23 });
  });

  it("ignores closed days when computing the window", () => {
    const hours: DayHours[] = Array.from({ length: 7 }, (_, dayOfWeek) => ({
      dayOfWeek,
      isOpen: dayOfWeek === 3,
      openTime: dayOfWeek === 3 ? "11:00" : null,
      closeTime: dayOfWeek === 3 ? "15:00" : null,
    }));
    expect(getWidestOpenWindow(hours)).toEqual({ startHour: 11, endHour: 15 });
  });

  it("falls back to the default window when every day is closed", () => {
    const hours: DayHours[] = Array.from({ length: 7 }, (_, dayOfWeek) => ({
      dayOfWeek,
      isOpen: false,
      openTime: null,
      closeTime: null,
    }));
    expect(getWidestOpenWindow(hours)).toEqual({ startHour: 7, endHour: 23 });
  });
});
