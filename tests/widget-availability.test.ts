import { describe, expect, it } from "vitest";
import { getAllSlotsForDay, getAvailableSlots, getSlotTimesForDay } from "@/lib/widget-availability";
import { zonedDateTimeToUtc } from "@/lib/reservation-dates";

const TZ = "America/Toronto";

const TABLES = [
  { id: "small", capacity: 2 },
  { id: "large", capacity: 6 },
];

// Empty array falls back to the default 7am-11pm, every day open.
const NO_HOURS_CONFIGURED: never[] = [];

describe("getAvailableSlots", () => {
  it("returns every 15-minute slot within business hours when nothing is booked", () => {
    const slots = getAvailableSlots(TABLES, [], {
      partySize: 2,
      date: "2026-07-13",
      businessHours: NO_HOURS_CONFIGURED,
      durationMinutes: 90,
      timeZone: TZ,
    });
    expect(slots[0]).toBe("07:00");
    expect(slots).toContain("07:15");
    // Last slot must still fit a full 90-minute booking before 11pm closing.
    expect(slots[slots.length - 1]).toBe("21:30");
  });

  it("excludes a slot once every fitting table is booked", () => {
    const reservations = [
      { tableId: "small", startsAt: zonedDateTimeToUtc("2026-07-13", "19:00", TZ), durationMinutes: 90 },
    ];
    const slots = getAvailableSlots([TABLES[0]!], reservations, {
      partySize: 2,
      date: "2026-07-13",
      businessHours: NO_HOURS_CONFIGURED,
      durationMinutes: 90,
      timeZone: TZ,
    });
    expect(slots).not.toContain("19:00");
    expect(slots).not.toContain("19:30"); // still overlaps the 90-minute booking
    expect(slots).toContain("20:30"); // booking has ended by then
  });

  it("does not exclude a slot when the conflicting reservation is on a different table", () => {
    const reservations = [
      { tableId: "small", startsAt: zonedDateTimeToUtc("2026-07-13", "19:00", TZ), durationMinutes: 90 },
    ];
    const slots = getAvailableSlots(TABLES, reservations, {
      partySize: 2,
      date: "2026-07-13",
      businessHours: NO_HOURS_CONFIGURED,
      durationMinutes: 90,
      timeZone: TZ,
    });
    expect(slots).toContain("19:00"); // "large" table is still free
  });

  it("returns an empty list when the party is bigger than every table", () => {
    const slots = getAvailableSlots(TABLES, [], {
      partySize: 20,
      date: "2026-07-13",
      businessHours: NO_HOURS_CONFIGURED,
      durationMinutes: 90,
      timeZone: TZ,
    });
    expect(slots).toEqual([]);
  });

  it("returns an empty list when the restaurant is closed that day", () => {
    // 2026-07-13 is a Monday (dayOfWeek 1).
    const businessHours = [{ dayOfWeek: 1, isOpen: false, openTime: null, closeTime: null }];
    const slots = getAvailableSlots(TABLES, [], {
      partySize: 2,
      date: "2026-07-13",
      businessHours,
      durationMinutes: 90,
      timeZone: TZ,
    });
    expect(slots).toEqual([]);
  });

  it("respects a custom, narrower business-hours window", () => {
    const businessHours = [{ dayOfWeek: 1, isOpen: true, openTime: "17:00", closeTime: "21:00" }];
    const slots = getAvailableSlots(TABLES, [], {
      partySize: 2,
      date: "2026-07-13",
      businessHours,
      durationMinutes: 90,
      timeZone: TZ,
    });
    expect(slots[0]).toBe("17:00");
    expect(slots[slots.length - 1]).toBe("19:30");
  });

  it("respects a custom reservation duration when checking whether a slot fits before closing", () => {
    const slots = getAvailableSlots(TABLES, [], {
      partySize: 2,
      date: "2026-07-13",
      businessHours: NO_HOURS_CONFIGURED,
      durationMinutes: 120,
      timeZone: TZ,
    });
    expect(slots[slots.length - 1]).toBe("21:00");
  });

  it("excludes an owner-blocked slot even when a table is free", () => {
    const slots = getAvailableSlots(TABLES, [], {
      partySize: 2,
      date: "2026-07-13",
      businessHours: NO_HOURS_CONFIGURED,
      durationMinutes: 90,
      timeZone: TZ,
      blockedTimes: ["19:00"],
    });
    expect(slots).not.toContain("19:00");
    expect(slots).toContain("18:45");
    expect(slots).toContain("19:15");
  });

  it("excludes a slot that has already started or passed, but leaves later slots bookable", () => {
    const slots = getAvailableSlots(TABLES, [], {
      partySize: 2,
      date: "2026-07-13",
      businessHours: NO_HOURS_CONFIGURED,
      durationMinutes: 90,
      timeZone: TZ,
      now: zonedDateTimeToUtc("2026-07-13", "16:00", TZ),
    });
    expect(slots).not.toContain("15:45");
    expect(slots).not.toContain("16:00"); // starting exactly now is also too late
    expect(slots).toContain("16:15");
  });

  it("doesn't exclude anything on a future date, regardless of the current time", () => {
    const slots = getAvailableSlots(TABLES, [], {
      partySize: 2,
      date: "2026-07-14",
      businessHours: NO_HOURS_CONFIGURED,
      durationMinutes: 90,
      timeZone: TZ,
      now: zonedDateTimeToUtc("2026-07-13", "16:00", TZ),
    });
    expect(slots[0]).toBe("07:00");
  });
});

describe("getSlotTimesForDay", () => {
  it("honors a half-hour business-hours boundary instead of rounding to the nearest hour", () => {
    const businessHours = [{ dayOfWeek: 1, isOpen: true, openTime: "16:30", closeTime: "19:30" }];
    const times = getSlotTimesForDay(businessHours, "2026-07-13", 90);
    expect(times[0]).toBe("16:30");
    expect(times[times.length - 1]).toBe("18:00");
  });

  it("lists every slot time within business hours regardless of tables or bookings", () => {
    const businessHours = [{ dayOfWeek: 1, isOpen: true, openTime: "17:00", closeTime: "21:00" }];
    const times = getSlotTimesForDay(businessHours, "2026-07-13", 90);
    expect(times[0]).toBe("17:00");
    expect(times[times.length - 1]).toBe("19:30");
  });

  it("returns an empty list when the restaurant is closed that day", () => {
    const businessHours = [{ dayOfWeek: 1, isOpen: false, openTime: null, closeTime: null }];
    expect(getSlotTimesForDay(businessHours, "2026-07-13", 90)).toEqual([]);
  });
});

describe("getAllSlotsForDay", () => {
  it("tags every business-hours slot as available or not instead of omitting unavailable ones", () => {
    const reservations = [
      { tableId: "small", startsAt: zonedDateTimeToUtc("2026-07-13", "19:00", TZ), durationMinutes: 90 },
    ];
    const businessHours = [{ dayOfWeek: 1, isOpen: true, openTime: "17:00", closeTime: "21:00" }];
    const slots = getAllSlotsForDay([TABLES[0]!], reservations, {
      partySize: 2,
      date: "2026-07-13",
      businessHours,
      durationMinutes: 90,
      timeZone: TZ,
      blockedTimes: ["17:30"],
    });

    // Full slot count is preserved -- nothing is dropped from the list.
    expect(slots).toHaveLength(getSlotTimesForDay(businessHours, "2026-07-13", 90).length);
    expect(slots.find((s) => s.time === "17:00")).toEqual({ time: "17:00", available: true });
    expect(slots.find((s) => s.time === "17:30")).toEqual({ time: "17:30", available: false }); // owner-blocked
    expect(slots.find((s) => s.time === "19:00")).toEqual({ time: "19:00", available: false }); // fully booked
  });
});
