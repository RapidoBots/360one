import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessRestaurant, resolveHomeRoute, type SessionUser } from "@/lib/auth-routes";

async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const { role, restaurantId } = session.user as typeof session.user & {
    role: SessionUser["role"];
    restaurantId: string | null;
  };

  if (!restaurantId) return { role, restaurantSlug: null };

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { slug: true },
  });
  return { role, restaurantSlug: restaurant?.slug ?? null };
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
