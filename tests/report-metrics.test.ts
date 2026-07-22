import { describe, expect, it } from "vitest";
import {
  reservationsPerDay,
  busiestDayOfWeek,
  busiestHourOfDay,
  reservationsPerTable,
  calculateRates,
  classifyGuests,
  topRepeatGuests,
  buildReservationsCsv,
} from "@/lib/report-metrics";

describe("reservationsPerDay", () => {
  it("buckets reservations by local calendar day across the range", () => {
    const range = {
      start: new Date(2026, 7, 1, 0, 0),
      end: new Date(2026, 7, 4, 0, 0), // Aug 1, 2, 3 (3 days)
    };
    const reservations = [
      { startsAt: new Date(2026, 7, 1, 10, 0) },
      { startsAt: new Date(2026, 7, 1, 19, 0) },
      { startsAt: new Date(2026, 7, 3, 12, 0) },
    ];
    const buckets = reservationsPerDay(reservations, range);
    expect(buckets).toHaveLength(3);
    expect(buckets.map((b) => b.value)).toEqual([2, 0, 1]);
  });
});

describe("busiestDayOfWeek", () => {
  it("buckets into Mon..Sun order regardless of input order", () => {
    const reservations = [
      { startsAt: new Date(2026, 7, 3) }, // Monday
      { startsAt: new Date(2026, 7, 3) }, // Monday
      { startsAt: new Date(2026, 7, 9) }, // Sunday
    ];
    const buckets = busiestDayOfWeek(reservations);
    expect(buckets.map((b) => b.label)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(buckets[0]).toEqual({ label: "Mon", value: 2 });
    expect(buckets[6]).toEqual({ label: "Sun", value: 1 });
  });
});

describe("busiestHourOfDay", () => {
  it("buckets by hour within the widest configured business-hours window", () => {
    const reservations = [
      { startsAt: new Date(2026, 7, 1, 19, 0) },
      { startsAt: new Date(2026, 7, 1, 19, 30) },
      { startsAt: new Date(2026, 7, 2, 12, 0) },
    ];
    const buckets = busiestHourOfDay(reservations, []);
    const at19 = buckets.find((b) => b.label === "7p");
    const at12 = buckets.find((b) => b.label === "12p");
    expect(at19?.value).toBe(2);
    expect(at12?.value).toBe(1);
  });

  it("widens its bucket range to cover every open day's hours", () => {
    // Every day explicitly configured (5 closed) so the default 7am-11pm
    // fallback for unconfigured days doesn't widen the window unexpectedly.
    const businessHours = Array.from({ length: 7 }, (_, dayOfWeek) => {
      if (dayOfWeek === 1) return { dayOfWeek, isOpen: true, openTime: "08:00", closeTime: "16:00" };
      if (dayOfWeek === 6) return { dayOfWeek, isOpen: true, openTime: "10:00", closeTime: "23:00" };
      return { dayOfWeek, isOpen: false, openTime: null, closeTime: null };
    });
    const buckets = busiestHourOfDay([], businessHours);
    expect(buckets[0]?.label).toBe("8a");
    expect(buckets[buckets.length - 1]?.label).toBe("10p");
  });
});

describe("reservationsPerTable", () => {
  it("counts reservations per table, sorted naturally by table number", () => {
    const tables = [
      { id: "t10", number: "10" },
      { id: "t1", number: "1" },
      { id: "t2", number: "2" },
    ];
    const reservations = [
      { tableId: "t1" },
      { tableId: "t1" },
      { tableId: "t10" },
      { tableId: null },
    ];
    const buckets = reservationsPerTable(reservations, tables);
    expect(buckets).toEqual([
      { label: "1", value: 2 },
      { label: "2", value: 0 },
      { label: "10", value: 1 },
    ]);
  });
});

describe("calculateRates", () => {
  it("computes no-show and cancellation rates as whole percentages", () => {
    const reservations = [
      { status: "COMPLETED" as const },
      { status: "COMPLETED" as const },
      { status: "NO_SHOW" as const },
      { status: "CANCELLED" as const },
    ];
    const rates = calculateRates(reservations);
    expect(rates.noShowRate).toBe(25);
    expect(rates.cancellationRate).toBe(25);
  });

  it("returns a full status breakdown in a fixed order", () => {
    const rates = calculateRates([{ status: "SEATED" as const }]);
    expect(rates.statusBreakdown.map((b) => b.label)).toEqual([
      "PENDING",
      "CONFIRMED",
      "SEATED",
      "COMPLETED",
      "CANCELLED",
      "NO_SHOW",
    ]);
    expect(rates.statusBreakdown.find((b) => b.label === "SEATED")?.value).toBe(1);
  });

  it("returns 0% rates for an empty range instead of dividing by zero", () => {
    const rates = calculateRates([]);
    expect(rates.noShowRate).toBe(0);
    expect(rates.cancellationRate).toBe(0);
  });
});

describe("classifyGuests", () => {
  it("splits guests into new vs. repeat using all-time counts", () => {
    const summary = classifyGuests(
      ["cust-a", "cust-b", "cust-a"], // cust-a appears twice in range, still one unique guest
      { "cust-a": 3, "cust-b": 1 }
    );
    expect(summary.totalUniqueGuests).toBe(2);
    expect(summary.repeatCount).toBe(1);
    expect(summary.newCount).toBe(1);
  });
});

describe("topRepeatGuests", () => {
  it("ranks repeat guests by all-time visit count, excluding new guests", () => {
    const guests = [
      { customerId: "cust-a", name: "Alice" },
      { customerId: "cust-b", name: "Bob" },
      { customerId: "cust-c", name: "Carol" },
    ];
    const allTimeCounts = { "cust-a": 5, "cust-b": 1, "cust-c": 3 };
    const top = topRepeatGuests(guests, allTimeCounts);
    expect(top).toEqual([
      { customerId: "cust-a", name: "Alice", visits: 5 },
      { customerId: "cust-c", name: "Carol", visits: 3 },
    ]);
  });

  it("respects the limit", () => {
    const guests = [
      { customerId: "cust-a", name: "Alice" },
      { customerId: "cust-b", name: "Bob" },
    ];
    const allTimeCounts = { "cust-a": 5, "cust-b": 4 };
    expect(topRepeatGuests(guests, allTimeCounts, 1)).toHaveLength(1);
  });
});

describe("buildReservationsCsv", () => {
  it("builds a header row plus one row per reservation", () => {
    const csv = buildReservationsCsv([
      { date: "2026-08-01", time: "07:00 PM", guestName: "Taylor Guest", partySize: 3, table: "5", status: "SEATED" },
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Date,Time,Guest Name,Party Size,Table,Status");
    expect(lines[1]).toBe("2026-08-01,07:00 PM,Taylor Guest,3,5,SEATED");
  });

  it("quotes a guest name containing a comma", () => {
    const csv = buildReservationsCsv([
      { date: "2026-08-01", time: "07:00 PM", guestName: "Guest, Jr.", partySize: 2, table: "", status: "PENDING" },
    ]);
    expect(csv.split("\n")[1]).toBe('2026-08-01,07:00 PM,"Guest, Jr.",2,,PENDING');
  });
});
