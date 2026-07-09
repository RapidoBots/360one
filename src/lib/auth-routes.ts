export type SessionUser = {
  role: "SUPER_ADMIN" | "OWNER" | "STAFF";
  restaurantSlug: string | null;
};

export function resolveHomeRoute(user: SessionUser): string {
  if (user.role === "SUPER_ADMIN") return "/admin";
  if (!user.restaurantSlug) return "/sign-in";
  return `/r/${user.restaurantSlug}/dashboard`;
}

export function canAccessRestaurant(user: SessionUser, targetSlug: string): boolean {
  return user.role === "SUPER_ADMIN" || user.restaurantSlug === targetSlug;
}
