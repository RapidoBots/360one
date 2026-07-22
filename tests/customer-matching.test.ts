import { describe, expect, it } from "vitest";
import { normalizePhone, normalizeEmail, customerMatchKey } from "@/lib/customer-matching";

describe("normalizePhone", () => {
  it("strips non-digit characters", () => {
    expect(normalizePhone("(555) 123-4567")).toBe("5551234567");
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Max@Example.com  ")).toBe("max@example.com");
  });
});

describe("customerMatchKey", () => {
  it("prefers phone over email when both are present", () => {
    expect(customerMatchKey({ phone: "555-123-4567", email: "max@example.com" })).toEqual({
      field: "phone",
      value: "5551234567",
    });
  });

  it("falls back to email when phone is absent", () => {
    expect(customerMatchKey({ phone: null, email: "Max@Example.com" })).toEqual({
      field: "email",
      value: "max@example.com",
    });
  });

  it("returns null when neither is present", () => {
    expect(customerMatchKey({ phone: null, email: null })).toBeNull();
  });
});
