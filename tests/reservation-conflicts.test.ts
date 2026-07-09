import { describe, expect, it } from "vitest";
import { doesOverlap } from "@/lib/reservation-conflicts";

describe("doesOverlap", () => {
  it("detects overlapping ranges", () => {
    const a = { startsAt: new Date("2026-01-01T19:00:00"), durationMinutes: 90 };
    const b = { startsAt: new Date("2026-01-01T19:30:00"), durationMinutes: 60 };
    expect(doesOverlap(a, b)).toBe(true);
  });

  it("does not flag ranges that don't touch", () => {
    const a = { startsAt: new Date("2026-01-01T19:00:00"), durationMinutes: 60 };
    const b = { startsAt: new Date("2026-01-01T21:00:00"), durationMinutes: 60 };
    expect(doesOverlap(a, b)).toBe(false);
  });

  it("treats back-to-back ranges (end === start) as non-overlapping", () => {
    const a = { startsAt: new Date("2026-01-01T19:00:00"), durationMinutes: 60 };
    const b = { startsAt: new Date("2026-01-01T20:00:00"), durationMinutes: 60 };
    expect(doesOverlap(a, b)).toBe(false);
  });
});
