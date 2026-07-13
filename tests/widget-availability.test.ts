import { describe, expect, it } from "vitest";
import { getAvailableSlots } from "@/lib/widget-availability";

const TABLES = [
  { id: "small", capacity: 2 },
  { id: "large", capacity: 6 },
];

describe("getAvailableSlots", () => {
  it("returns every 15-minute slot within business hours when nothing is booked", () => {
    const slots = getAvailableSlots(TABLES, [], { partySize: 2, date: "2026-07-13" });
    expect(slots[0]).toBe("07:00");
    expect(slots).toContain("07:15");
    // Last slot must still fit a full 90-minute booking before 11pm closing.
    expect(slots[slots.length - 1]).toBe("21:30");
  });

  it("excludes a slot once every fitting table is booked", () => {
    const reservations = [
      { tableId: "small", startsAt: new Date("2026-07-13T19:00:00"), durationMinutes: 90 },
    ];
    const slots = getAvailableSlots([TABLES[0]!], reservations, { partySize: 2, date: "2026-07-13" });
    expect(slots).not.toContain("19:00");
    expect(slots).not.toContain("19:30"); // still overlaps the 90-minute booking
    expect(slots).toContain("20:30"); // booking has ended by then
  });

  it("does not exclude a slot when the conflicting reservation is on a different table", () => {
    const reservations = [
      { tableId: "small", startsAt: new Date("2026-07-13T19:00:00"), durationMinutes: 90 },
    ];
    const slots = getAvailableSlots(TABLES, reservations, { partySize: 2, date: "2026-07-13" });
    expect(slots).toContain("19:00"); // "large" table is still free
  });

  it("returns an empty list when the party is bigger than every table", () => {
    const slots = getAvailableSlots(TABLES, [], { partySize: 20, date: "2026-07-13" });
    expect(slots).toEqual([]);
  });
});
