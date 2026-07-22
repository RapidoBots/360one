import { describe, expect, it } from "vitest";
import { sortTablesByNumber } from "@/lib/sort-tables";

describe("sortTablesByNumber", () => {
  it("sorts purely numeric table numbers numerically, not lexicographically", () => {
    const tables = [{ number: "10" }, { number: "1" }, { number: "3" }, { number: "2" }];
    expect(sortTablesByNumber(tables).map((t) => t.number)).toEqual(["1", "2", "3", "10"]);
  });

  it("handles mixed alphanumeric labels", () => {
    const tables = [{ number: "Patio-10" }, { number: "Patio-2" }, { number: "Bar-1" }];
    expect(sortTablesByNumber(tables).map((t) => t.number)).toEqual(["Bar-1", "Patio-2", "Patio-10"]);
  });

  it("does not mutate the original array", () => {
    const tables = [{ number: "2" }, { number: "1" }];
    const sorted = sortTablesByNumber(tables);
    expect(tables.map((t) => t.number)).toEqual(["2", "1"]);
    expect(sorted.map((t) => t.number)).toEqual(["1", "2"]);
  });
});
