import { describe, expect, it } from "vitest";
import { recommendTable, listAvailableTables } from "@/lib/table-allocation";

const TABLES = [
  { id: "small", capacity: 2 },
  { id: "medium", capacity: 4 },
  { id: "large", capacity: 6 },
];

const START = new Date("2026-07-13T19:00:00");

describe("recommendTable", () => {
  it("recommends the smallest table that fits the party", () => {
    expect(recommendTable(TABLES, [], { partySize: 2, startsAt: START, durationMinutes: 90 })).toBe("small");
  });

  it("skips tables that are too small for the party", () => {
    expect(recommendTable(TABLES, [], { partySize: 5, startsAt: START, durationMinutes: 90 })).toBe("large");
  });

  it("excludes a table with a conflicting reservation", () => {
    const reservations = [{ tableId: "small", startsAt: START, durationMinutes: 90 }];
    expect(recommendTable(TABLES, reservations, { partySize: 2, startsAt: START, durationMinutes: 90 })).toBe("medium");
  });

  it("does not exclude a table whose reservation doesn't overlap", () => {
    const reservations = [
      { tableId: "small", startsAt: new Date("2026-07-13T12:00:00"), durationMinutes: 60 },
    ];
    expect(recommendTable(TABLES, reservations, { partySize: 2, startsAt: START, durationMinutes: 90 })).toBe("small");
  });

  it("returns null when no table fits or all fitting tables are booked", () => {
    const reservations = [
      { tableId: "small", startsAt: START, durationMinutes: 90 },
      { tableId: "medium", startsAt: START, durationMinutes: 90 },
      { tableId: "large", startsAt: START, durationMinutes: 90 },
    ];
    expect(recommendTable(TABLES, reservations, { partySize: 2, startsAt: START, durationMinutes: 90 })).toBe(null);
  });

  it("returns null when the party is larger than every table", () => {
    expect(recommendTable(TABLES, [], { partySize: 20, startsAt: START, durationMinutes: 90 })).toBe(null);
  });
});

describe("listAvailableTables", () => {
  const NOW = new Date("2026-07-14T19:00:00");

  it("returns every fitting table sorted smallest-first", () => {
    const result = listAvailableTables(TABLES, [], { partySize: 2, now: NOW });
    expect(result.map((t) => t.id)).toEqual(["small", "medium", "large"]);
  });

  it("returns an empty list when nothing fits", () => {
    expect(listAvailableTables(TABLES, [], { partySize: 20, now: NOW })).toEqual([]);
  });

  it("excludes a table with a conflicting reservation", () => {
    const reservations = [{ tableId: "small", startsAt: NOW, durationMinutes: 90 }];
    const result = listAvailableTables(TABLES, reservations, { partySize: 2, now: NOW });
    expect(result.map((t) => t.id)).toEqual(["medium", "large"]);
  });

  it("does not exclude a table whose conflicting reservation is on a different table", () => {
    const reservations = [{ tableId: "large", startsAt: NOW, durationMinutes: 90 }];
    const result = listAvailableTables(TABLES, reservations, { partySize: 2, now: NOW });
    expect(result.map((t) => t.id)).toEqual(["small", "medium"]);
  });
});
