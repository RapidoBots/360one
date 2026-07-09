import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveHomeRoute, type SessionUser } from "@/lib/auth-routes";

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/sign-in");

  const { role, restaurantId } = session.user as typeof session.user & {
    role: SessionUser["role"];
    restaurantId: string | null;
  };

  let restaurantSlug: string | null = null;
  if (restaurantId) {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { slug: true },
    });
    restaurantSlug = restaurant?.slug ?? null;
  }

  redirect(resolveHomeRoute({ role, restaurantSlug }));
}
