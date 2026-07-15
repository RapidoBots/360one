import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { EmbedSnippet } from "./embed-snippet";
import { BusinessHoursForm } from "./business-hours-form";

export default async function RestaurantSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    include: { businessHours: true },
  });
  if (!restaurant) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <EmbedSnippet slug={slug} />
      <BusinessHoursForm
        slug={slug}
        businessHours={restaurant.businessHours}
        defaultReservationDurationMinutes={restaurant.defaultReservationDurationMinutes}
      />
    </div>
  );
}
