import { describe, expect, it } from "vitest";
import { getTableStatus, type TableStatusReservation } from "@/lib/table-status";

function reservation(overrides: Partial<TableStatusReservation> = {}): TableStatusReservation {
  return {
    id: "r1",
    tableId: "t1",
    startsAt: new Date("2026-07-13T19:00:00"),
    durationMinutes: 90,
    status: "CONFIRMED",
    partySize: 2,
    customerName: "Taylor Guest",
    ...overrides,
  };
}

describe("getTableStatus", () => {
  const now = new Date("2026-07-13T19:00:00");

  it("returns AVAILABLE when the table has no reservations", () => {
    expect(getTableStatus("t1", [], now)).toEqual({ status: "AVAILABLE", reservation: null });
  });

  it("returns SEATED when a SEATED reservation exists for the table", () => {
    const r = reservation({ status: "SEATED" });
    expect(getTableStatus("t1", [r], now)).toEqual({ status: "SEATED", reservation: r });
  });

  it("returns RESERVED_SOON when a CONFIRMED reservation starts within 30 minutes", () => {
    const r = reservation({ startsAt: new Date("2026-07-13T19:20:00") });
    expect(getTableStatus("t1", [r], now)).toEqual({ status: "RESERVED_SOON", reservation: r });
  });

  it("returns RESERVED_SOON when a CONFIRMED reservation is already underway", () => {
    // Started 20 minutes ago, 90-minute duration -- still within its window.
    const r = reservation({ startsAt: new Date("2026-07-13T18:40:00") });
    expect(getTableStatus("t1", [r], now)).toEqual({ status: "RESERVED_SOON", reservation: r });
  });

  it("returns AVAILABLE when a CONFIRMED reservation starts more than 30 minutes out", () => {
    const r = reservation({ startsAt: new Date("2026-07-13T20:00:00") });
    expect(getTableStatus("t1", [r], now)).toEqual({ status: "AVAILABLE", reservation: null });
  });

  it("returns AVAILABLE once a CONFIRMED reservation's expected window has fully passed", () => {
    const r = reservation({ startsAt: new Date("2026-07-13T16:00:00"), durationMinutes: 90 });
    expect(getTableStatus("t1", [r], now)).toEqual({ status: "AVAILABLE", reservation: null });
  });

  it("ignores reservations for other tables", () => {
    const r = reservation({ tableId: "other-table", status: "SEATED" });
    expect(getTableStatus("t1", [r], now)).toEqual({ status: "AVAILABLE", reservation: null });
  });
});
