import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRestaurantAccess } from "@/lib/auth-guards";
import { resolveHomeRoute } from "@/lib/auth-routes";
import { EmbedSnippet } from "./embed-snippet";
import { BusinessHoursForm } from "./business-hours-form";
import { AvailabilityForm } from "./availability-form";
import { TeamMembers } from "./team-members";
import { StaffPermissions } from "./staff-permissions";
import { RestaurantProfileForm } from "./restaurant-profile-form";
import { SettingsTabs } from "./settings-tabs";

export default async function RestaurantSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { user: sessionUser } = await requireRestaurantAccess(slug);
  // Settings is owner-only -- it's not one of the per-feature access toggles.
  if (sessionUser.role !== "OWNER" && sessionUser.role !== "SUPER_ADMIN") {
    redirect(resolveHomeRoute(sessionUser));
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    include: {
      businessHours: true,
      users: {
        select: {
          id: true, name: true, email: true, role: true, active: true,
          reservationsAccess: true, waitlistAccess: true, floorManagerAccess: true,
          customersAccess: true, reportsAccess: true,
        },
        orderBy: { role: "asc" },
      },
    },
  });
  if (!restaurant) notFound();

  const staffMembers = restaurant.users.filter((u) => u.role === "STAFF");
  const ownerMember = restaurant.users.find((u) => u.role === "OWNER") ?? restaurant.users[0];

  return (
    <div className="-m-4 min-h-[calc(100vh-4rem)] scroll-smooth bg-surface-page p-5 [@media(min-width:375px)]:p-[clamp(20px,3vw,40px)] md:-m-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[32px] font-extrabold tracking-tight text-ink">Settings</h1>
          <p className="text-[15px] text-ink-muted">
            Manage your restaurant profile, booking widget, opening hours, team and permissions.
          </p>
        </div>

        <SettingsTabs />

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
          successMessage={restaurant.successMessage}
          successButtonText={restaurant.successButtonText}
        />
        <EmbedSnippet slug={slug} />
        <BusinessHoursForm
          slug={slug}
          businessHours={restaurant.businessHours}
          defaultReservationDurationMinutes={restaurant.defaultReservationDurationMinutes}
        />
        <AvailabilityForm slug={slug} timezone={restaurant.timezone} />
        <TeamMembers slug={slug} members={restaurant.users} currentUserId={sessionUser.id} />
        <StaffPermissions slug={slug} members={staffMembers} owner={{ name: ownerMember?.name ?? "Owner" }} />
      </div>
    </div>
  );
}
