export type SessionUser = {
  id: string;
  name: string;
  role: "SUPER_ADMIN" | "OWNER" | "STAFF";
  restaurantSlug: string | null;
};

export function resolveHomeRoute(
  user: Pick<SessionUser, "role" | "restaurantSlug">,
  opts?: { schedulingEnabled?: boolean }
): string {
  if (user.role === "SUPER_ADMIN") return "/admin";
  if (!user.restaurantSlug) return "/sign-in";
  // Staff land on their own shifts rather than the owner-oriented dashboard --
  // but only if scheduling is actually on, since the Staff page 404s otherwise.
  if (user.role === "STAFF" && opts?.schedulingEnabled) return `/r/${user.restaurantSlug}/staff`;
  return `/r/${user.restaurantSlug}/dashboard`;
}

export function canAccessRestaurant(user: Pick<SessionUser, "role" | "restaurantSlug">, targetSlug: string): boolean {
  return user.role === "SUPER_ADMIN" || user.restaurantSlug === targetSlug;
}
