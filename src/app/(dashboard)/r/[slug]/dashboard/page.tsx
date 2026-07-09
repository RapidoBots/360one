import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant) notFound();

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Welcome to {restaurant.name}</h1>
      <p className="text-base text-muted-foreground">
        Reservation widgets, occupancy, and today&apos;s arrivals land here in Phase 3.
      </p>
    </div>
  );
}
