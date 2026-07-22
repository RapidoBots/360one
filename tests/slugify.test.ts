import { describe, expect, it } from "vitest";
import { slugify } from "@/lib/slugify";

describe("slugify", () => {
  it("lowercases and hyphenates spaces", () => {
    expect(slugify("The Blue Fork")).toBe("the-blue-fork");
  });

  it("collapses repeated symbols/spaces into one hyphen", () => {
    expect(slugify("Joe's  Diner!!")).toBe("joe-s-diner");
  });

  it("trims leading/trailing hyphens", () => {
    expect(slugify("  -Cafe-  ")).toBe("cafe");
  });

  it("returns an empty string for an all-symbol input", () => {
    expect(slugify("!!!")).toBe("");
  });
});
