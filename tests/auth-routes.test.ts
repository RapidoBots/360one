import { describe, expect, it } from "vitest";
import { canAccessRestaurant, resolveHomeRoute } from "@/lib/auth-routes";

describe("resolveHomeRoute", () => {
  it("sends Super Admins to /admin", () => {
    expect(resolveHomeRoute({ role: "SUPER_ADMIN", restaurantSlug: null })).toBe("/admin");
  });

  it("sends Owners/Staff to their restaurant dashboard", () => {
    expect(resolveHomeRoute({ role: "OWNER", restaurantSlug: "blue-fork" })).toBe(
      "/r/blue-fork/dashboard"
    );
    expect(resolveHomeRoute({ role: "STAFF", restaurantSlug: "blue-fork" })).toBe(
      "/r/blue-fork/dashboard"
    );
  });

  it("sends a restaurant user with no restaurant back to sign-in", () => {
    expect(resolveHomeRoute({ role: "STAFF", restaurantSlug: null })).toBe("/sign-in");
  });
});

describe("canAccessRestaurant", () => {
  it("lets Super Admin access any restaurant", () => {
    expect(canAccessRestaurant({ role: "SUPER_ADMIN", restaurantSlug: null }, "any-slug")).toBe(true);
  });

  it("lets a restaurant user access only their own restaurant", () => {
    const user = { role: "OWNER" as const, restaurantSlug: "blue-fork" };
    expect(canAccessRestaurant(user, "blue-fork")).toBe(true);
    expect(canAccessRestaurant(user, "other-restaurant")).toBe(false);
  });
});
