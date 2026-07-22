import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RestaurantDetail } from "./restaurant-detail";

export default async function RestaurantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    include: {
      users: {
        select: { id: true, name: true, email: true, role: true },
        orderBy: { role: "asc" },
      },
    },
  });
  if (!restaurant) notFound();

  return <RestaurantDetail restaurant={restaurant} />;
}
