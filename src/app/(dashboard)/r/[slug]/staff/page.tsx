import { prisma } from "@/lib/prisma";
import { StaffPageClient } from "./staff-page-client";
import { SchedulingLocked } from "./scheduling-locked";

export default async function StaffPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  const restaurant = await prisma.restaurant.findUniqueOrThrow({ where: { slug } });

  if (!restaurant.schedulingEnabled) {
    return <SchedulingLocked />;
  }

  const members = await prisma.user.findMany({
    where: { restaurantId: restaurant.id },
    select: { id: true, name: true, email: true, role: true, position: true, customPosition: true, active: true },
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

  return (
    <StaffPageClient
      slug={slug}
      members={members}
      shifts={shifts}
      exchanges={exchanges}
      weekStart={weekStart}
      timezone={restaurant.timezone}
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
