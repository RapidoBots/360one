import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth-guards";
import { StaffPageClient } from "./staff-page-client";

export default async function StaffPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ week?: string; tab?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  const restaurant = await prisma.restaurant.findUniqueOrThrow({ where: { slug } });

  if (!restaurant.schedulingEnabled) notFound();

  const sessionUser = await getSessionUser();

  const members = await prisma.user.findMany({
    where: { restaurantId: restaurant.id },
    select: {
      id: true, name: true, email: true, role: true,
      position: true, customPosition: true, active: true, availabilityOff: true,
    },
    orderBy: { name: "asc" },
  });

  const weekStart = sp.week ?? getMonday(new Date(), restaurant.timezone);
  const weekEnd = addDays(weekStart, 6);

  const shifts = await prisma.shift.findMany({
    where: {
      restaurantId: restaurant.id,
      date: { gte: weekStart, lte: weekEnd },
    },
    include: { user: { select: { id: true, name: true } } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  const exchanges = await prisma.shiftExchange.findMany({
    where: { restaurantId: restaurant.id },
    include: {
      requesterShift: { include: { user: { select: { id: true, name: true } } } },
      targetShift: { include: { user: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const timeOffRequests = await prisma.timeOffRequest.findMany({
    where: { restaurantId: restaurant.id },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <StaffPageClient
      slug={slug}
      members={members}
      shifts={shifts}
      exchanges={exchanges}
      timeOffRequests={timeOffRequests}
      weekStart={weekStart}
      timezone={restaurant.timezone}
      currentUserId={sessionUser?.id ?? ""}
      currentUserRole={sessionUser?.role ?? "STAFF"}
      initialTab={sp.tab}
    />
  );
}

function getMonday(now: Date, _tz: string): string {
  const d = new Date(now);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
