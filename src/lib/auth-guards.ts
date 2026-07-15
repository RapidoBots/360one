import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessRestaurant, resolveHomeRoute, type SessionUser } from "@/lib/auth-routes";

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const { id, role, restaurantId, active } = session.user as typeof session.user & {
    role: SessionUser["role"];
    restaurantId: string | null;
    active: boolean;
  };
  if (!active) return null;

  if (!restaurantId) return { id, role, restaurantSlug: null };

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { slug: true },
  });
  return { id, role, restaurantSlug: restaurant?.slug ?? null };
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
