import { prisma } from "@/lib/prisma";
import { getDayRange, getWeekRange } from "@/lib/reservation-dates";
import { ReservationsCalendar, type CalendarView } from "./reservations-calendar";
import type { ReservationStatus } from "@/generated/prisma/client";

export default async function ReservationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ view?: string; date?: string; q?: string; status?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const view: CalendarView = sp.view === "week" || sp.view === "timeline" ? sp.view : "day";
  const date = sp.date ? new Date(`${sp.date}T00:00:00`) : new Date();
  const statusFilter = sp.status ? (sp.status.split(",").filter(Boolean) as ReservationStatus[]) : [];

  const restaurant = await prisma.restaurant.findUniqueOrThrow({ where: { slug } });
  const { start, end } = view === "week" ? getWeekRange(date) : getDayRange(date);

  const reservations = await prisma.reservation.findMany({
    where: {
      restaurantId: restaurant.id,
      startsAt: { gte: start, lt: end },
      ...(statusFilter.length > 0 ? { status: { in: statusFilter } } : {}),
      ...(sp.q
        ? {
            customer: {
              OR: [
                { name: { contains: sp.q, mode: "insensitive" } },
                { phone: { contains: sp.q } },
              ],
            },
          }
        : {}),
    },
    include: { customer: { select: { name: true, email: true, phone: true } }, table: { select: { number: true } } },
    orderBy: { startsAt: "asc" },
  });

  const tables = await prisma.table.findMany({ where: { restaurantId: restaurant.id }, orderBy: { number: "asc" } });

  return (
    <ReservationsCalendar
      slug={slug}
      view={view}
      date={view === "week" ? start : date}
      reservations={reservations}
      tables={tables}
    />
  );
}
