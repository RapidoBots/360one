import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRestaurantAccess } from "@/lib/auth-guards";
import { resolveHomeRoute } from "@/lib/auth-routes";
import { EmployeeProfileClient } from "./employee-profile-client";

export default async function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const { user: sessionUser, restaurant } = await requireRestaurantAccess(slug);
  // Same gate as Settings -- this page is reached from the Team members table.
  if (sessionUser.role !== "OWNER" && sessionUser.role !== "SUPER_ADMIN") {
    redirect(resolveHomeRoute(sessionUser));
  }

  const members = await prisma.user.findMany({
    where: { restaurantId: restaurant.id },
    select: {
      id: true, name: true, email: true, role: true, active: true, createdAt: true,
      reservationsAccess: true, waitlistAccess: true, floorManagerAccess: true,
      customersAccess: true, reportsAccess: true,
    },
    orderBy: { role: "asc" },
  });
  const member = members.find((m) => m.id === id);
  if (!member) notFound();

  const lastSession = await prisma.session.findFirst({
    where: { userId: id },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  return (
    <EmployeeProfileClient
      slug={slug}
      member={member}
      members={members}
      lastSignInAt={lastSession?.createdAt ?? null}
    />
  );
}
