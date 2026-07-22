import { describe, expect, it } from "vitest";
import { getAvailableSlots } from "@/lib/widget-availability";

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
    });
    expect(slots[0]).toBe("07:00");
    expect(slots).toContain("07:15");
    // Last slot must still fit a full 90-minute booking before 11pm closing.
    expect(slots[slots.length - 1]).toBe("21:30");
  });

  it("excludes a slot once every fitting table is booked", () => {
    const reservations = [
      { tableId: "small", startsAt: new Date("2026-07-13T19:00:00"), durationMinutes: 90 },
    ];
    const slots = getAvailableSlots([TABLES[0]!], reservations, {
      partySize: 2,
      date: "2026-07-13",
      businessHours: NO_HOURS_CONFIGURED,
      durationMinutes: 90,
    });
    expect(slots).not.toContain("19:00");
    expect(slots).not.toContain("19:30"); // still overlaps the 90-minute booking
    expect(slots).toContain("20:30"); // booking has ended by then
  });

  it("does not exclude a slot when the conflicting reservation is on a different table", () => {
    const reservations = [
      { tableId: "small", startsAt: new Date("2026-07-13T19:00:00"), durationMinutes: 90 },
    ];
    const slots = getAvailableSlots(TABLES, reservations, {
      partySize: 2,
      date: "2026-07-13",
      businessHours: NO_HOURS_CONFIGURED,
      durationMinutes: 90,
    });
    expect(slots).toContain("19:00"); // "large" table is still free
  });

  it("returns an empty list when the party is bigger than every table", () => {
    const slots = getAvailableSlots(TABLES, [], {
      partySize: 20,
      date: "2026-07-13",
      businessHours: NO_HOURS_CONFIGURED,
      durationMinutes: 90,
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
    });
    expect(slots[slots.length - 1]).toBe("21:00");
  });
});
