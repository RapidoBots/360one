import { prisma } from "@/lib/prisma";
import { RestaurantsList, type RestaurantListItem } from "./restaurants-list";

export default async function AdminRestaurantsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;

  const restaurants = await prisma.restaurant.findMany({
    where: sp.q
      ? {
          OR: [
            { name: { contains: sp.q, mode: "insensitive" } },
            { slug: { contains: sp.q, mode: "insensitive" } },
          ],
        }
      : {},
    include: { _count: { select: { users: true } } },
    orderBy: { createdAt: "desc" },
  });

  const items: RestaurantListItem[] = restaurants.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    status: r.status,
    createdAt: r.createdAt,
    userCount: r._count.users,
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Restaurants</h1>
      <RestaurantsList restaurants={items} />
    </div>
  );
}
