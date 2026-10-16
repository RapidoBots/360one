import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessRestaurant, resolveHomeRoute, type SessionUser } from "@/lib/auth-routes";
import type { FeatureAccess } from "@/generated/prisma/client";

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const { id, name, role, restaurantId, active } = session.user as typeof session.user & {
    role: SessionUser["role"];
    restaurantId: string | null;
    active: boolean;
  };
  if (!active) return null;

  if (!restaurantId) return { id, name, role, restaurantSlug: null };

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { slug: true },
  });
  return { id, name, role, restaurantSlug: restaurant?.slug ?? null };
}

// ── Per-feature staff access ──
// OWNER and SUPER_ADMIN always have full access; STAFF access is per-feature,
// set by the owner from Settings → Permissions (defaults to EDIT so existing
// staff aren't locked out when this ships).

export const FEATURE_COLUMNS = {
  reservations: "reservationsAccess",
  waitlist: "waitlistAccess",
  floorManager: "floorManagerAccess",
  customers: "customersAccess",
  reports: "reportsAccess",
} as const;

export type FeatureKey = keyof typeof FEATURE_COLUMNS;

const ACCESS_RANK: Record<FeatureAccess, number> = { NONE: 0, VIEW: 1, EDIT: 2 };

export async function getFeatureAccess(user: SessionUser, feature: FeatureKey): Promise<FeatureAccess> {
  if (user.role !== "STAFF") return "EDIT";
  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      reservationsAccess: true,
      waitlistAccess: true,
      floorManagerAccess: true,
      customersAccess: true,
      reportsAccess: true,
    },
  });
  return record?.[FEATURE_COLUMNS[feature]] ?? "NONE";
}

export async function getAllFeatureAccess(user: SessionUser): Promise<Record<FeatureKey, FeatureAccess>> {
  if (user.role !== "STAFF") {
    return { reservations: "EDIT", waitlist: "EDIT", floorManager: "EDIT", customers: "EDIT", reports: "EDIT" };
  }
  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      reservationsAccess: true,
      waitlistAccess: true,
      floorManagerAccess: true,
      customersAccess: true,
      reportsAccess: true,
    },
  });
  return {
    reservations: record?.reservationsAccess ?? "NONE",
    waitlist: record?.waitlistAccess ?? "NONE",
    floorManager: record?.floorManagerAccess ?? "NONE",
    customers: record?.customersAccess ?? "NONE",
    reports: record?.reportsAccess ?? "NONE",
  };
}

// For Server Components: redirects away if the signed-in user's access to
// `feature` is below `min`.
export async function requireFeatureAccess(slug: string, feature: FeatureKey, min: FeatureAccess) {
  const { user, restaurant } = await requireRestaurantAccess(slug);
  const access = await getFeatureAccess(user, feature);
  if (ACCESS_RANK[access] < ACCESS_RANK[min]) redirect(resolveHomeRoute(user));
  return { user, restaurant, access };
}

// Same reasoning as assertRestaurantMember: for Server Actions, not Server Components.
export async function assertFeatureAccess(slug: string, feature: FeatureKey, min: FeatureAccess) {
  const { user, restaurant } = await assertRestaurantMember(slug);
  const access = await getFeatureAccess(user, feature);
  if (ACCESS_RANK[access] < ACCESS_RANK[min]) throw new Error("Not authorized — insufficient access for this feature.");
  return { user, restaurant };
}

export async function requireSuperAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "SUPER_ADMIN") redirect(resolveHomeRoute(user));
  return user;
}

export async function requireRestaurantAccess(slug: string) {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  if (!canAccessRestaurant(user, slug)) redirect(resolveHomeRoute(user));

  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant || restaurant.status !== "ACTIVE") notFound();

  return { user, restaurant };
}

// For Server Actions: throws a plain Error instead of calling redirect()/
// notFound(), since those Next.js functions assume a render context that
// Server Actions don't reliably provide.
export async function assertRestaurantMember(slug: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Not authenticated");
  if (!canAccessRestaurant(user, slug)) throw new Error("Not authorized for this restaurant");

  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant || restaurant.status !== "ACTIVE") throw new Error("Restaurant not found");

  return { user, restaurant };
}

// Same reasoning as assertRestaurantMember: for Server Actions, not Server Components.
export async function assertRestaurantOwner(slug: string) {
  const { user, restaurant } = await assertRestaurantMember(slug);
  if (user.role !== "OWNER") throw new Error("Not authorized — Owner access required");
  return { user, restaurant };
}

// Same reasoning as assertRestaurantMember: for Server Actions, not Server Components.
export async function assertSuperAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("Not authenticated");
  if (user.role !== "SUPER_ADMIN") throw new Error("Not authorized");
  return user;
}
