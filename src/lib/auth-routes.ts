export type SessionUser = {
  id: string;
  role: "SUPER_ADMIN" | "OWNER" | "STAFF";
  restaurantSlug: string | null;
};

export function resolveHomeRoute(user: Pick<SessionUser, "role" | "restaurantSlug">): string {
  if (user.role === "SUPER_ADMIN") return "/admin";
  if (!user.restaurantSlug) return "/sign-in";
  return `/r/${user.restaurantSlug}/dashboard`;
}

export function canAccessRestaurant(user: Pick<SessionUser, "role" | "restaurantSlug">, targetSlug: string): boolean {
  return user.role === "SUPER_ADMIN" || user.restaurantSlug === targetSlug;
}
