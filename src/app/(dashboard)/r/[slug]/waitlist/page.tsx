import { prisma } from "@/lib/prisma";
import { getDayRange } from "@/lib/reservation-dates";
import { sortTablesByNumber } from "@/lib/sort-tables";
import { WaitlistView } from "./waitlist-view";

export default async function WaitlistPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const restaurant = await prisma.restaurant.findUniqueOrThrow({ where: { slug } });
  const { start, end } = getDayRange(new Date());

  const [waiting, todayHistory, rawTables, reservations] = await Promise.all([
    prisma.waitlistEntry.findMany({
      where: { restaurantId: restaurant.id, status: "WAITING" },
      include: { customer: { select: { name: true, phone: true } } },
      orderBy: { joinedAt: "asc" },
    }),
    prisma.waitlistEntry.findMany({
      where: {
        restaurantId: restaurant.id,
        status: { in: ["SEATED", "CANCELLED", "NO_SHOW"] },
        joinedAt: { gte: start, lt: end },
      },
      include: { customer: { select: { name: true, phone: true } } },
      orderBy: { joinedAt: "desc" },
    }),
    prisma.table.findMany({
      where: { restaurantId: restaurant.id },
      select: { id: true, number: true, capacity: true },
    }),
    prisma.reservation.findMany({
      where: {
        restaurantId: restaurant.id,
        startsAt: { gte: start, lt: end },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
      },
      select: { tableId: true, startsAt: true, durationMinutes: true },
    }),
  ]);

  return (
    <WaitlistView
      slug={slug}
      waiting={waiting}
      todayHistory={todayHistory}
      tables={sortTablesByNumber(rawTables)}
      reservations={reservations}
    />
  );
}
