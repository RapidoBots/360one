import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BookingWidget } from "./booking-widget";

export default async function BookingWidgetPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });

  if (!restaurant) notFound();

  if (restaurant.status !== "ACTIVE") {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <p className="max-w-sm text-base text-muted-foreground">
          This restaurant isn&apos;t currently accepting online reservations.
        </p>
      </div>
    );
  }

  return <BookingWidget slug={slug} restaurantName={restaurant.name} />;
}
