import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth-guards";
import { EmbedSnippet } from "./embed-snippet";
import { BusinessHoursForm } from "./business-hours-form";
import { AvailabilityForm } from "./availability-form";
import { TeamMembers } from "./team-members";
import { RestaurantProfileForm } from "./restaurant-profile-form";

export default async function RestaurantSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    include: {
      businessHours: true,
      users: { select: { id: true, name: true, email: true, role: true, active: true }, orderBy: { role: "asc" } },
    },
  });
  if (!restaurant) notFound();

  const sessionUser = await getSessionUser();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <RestaurantProfileForm
        slug={slug}
        timezone={restaurant.timezone}
        logoUrl={restaurant.logoUrl}
        bannerUrl={restaurant.bannerUrl}
        mapsEmbedUrl={restaurant.mapsEmbedUrl}
        address={restaurant.address}
        phone={restaurant.phone}
        notes={restaurant.notes}
        facebookUrl={restaurant.facebookUrl}
        instagramUrl={restaurant.instagramUrl}
      />
      <EmbedSnippet slug={slug} />
      <BusinessHoursForm
        slug={slug}
        businessHours={restaurant.businessHours}
        defaultReservationDurationMinutes={restaurant.defaultReservationDurationMinutes}
      />
      <AvailabilityForm slug={slug} timezone={restaurant.timezone} />
      <TeamMembers slug={slug} members={restaurant.users} currentUserId={sessionUser?.id ?? ""} />
    </div>
  );
}
