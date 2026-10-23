import { describe, expect, it } from "vitest";
import { getEffectiveSize, getChairCounts } from "@/lib/table-layout";

describe("getEffectiveSize", () => {
  it("uses the smallest tier for capacity 2 or less", () => {
    expect(getEffectiveSize(2, null, null)).toEqual({ width: 56, height: 56 });
    expect(getEffectiveSize(1, null, null)).toEqual({ width: 56, height: 56 });
  });

  it("uses the mid tier for capacity 3-4", () => {
    expect(getEffectiveSize(4, null, null)).toEqual({ width: 80, height: 80 });
  });

  it("uses the largest tier above capacity 4", () => {
    expect(getEffectiveSize(8, null, null)).toEqual({ width: 96, height: 96 });
  });

  it("prefers an explicit width/height over the capacity default", () => {
    expect(getEffectiveSize(2, 200, 60)).toEqual({ width: 200, height: 60 });
  });

  it("falls back to the default independently per axis", () => {
    expect(getEffectiveSize(2, 200, null)).toEqual({ width: 200, height: 56 });
  });
});

describe("getChairCounts", () => {
  it("auto-distributes evenly across sides when nothing is explicit", () => {
    expect(getChairCounts(4, null, null, null, null)).toEqual({ top: 1, right: 1, bottom: 1, left: 1 });
  });

  it("cycles top/right/bottom/left for capacities not divisible by 4", () => {
    expect(getChairCounts(2, null, null, null, null)).toEqual({ top: 1, right: 1, bottom: 0, left: 0 });
    expect(getChairCounts(6, null, null, null, null)).toEqual({ top: 2, right: 2, bottom: 1, left: 1 });
  });

  it("uses explicit per-side counts once any side is set, defaulting unset sides to 0", () => {
    expect(getChairCounts(4, 0, 2, null, 2)).toEqual({ top: 0, right: 2, bottom: 0, left: 2 });
  });

  it("treats an explicit 0 on every side as fully customized (no chairs)", () => {
    expect(getChairCounts(4, 0, 0, 0, 0)).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });
});
