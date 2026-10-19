import { prisma } from "@/lib/prisma";
import { requireFeatureAccess } from "@/lib/auth-guards";
import { getDayRange, getWeekRange, getZonedDayOfWeek, zonedDateTimeToUtc } from "@/lib/reservation-dates";
import { sortTablesByNumber } from "@/lib/sort-tables";
import { getHoursForDay } from "@/lib/business-hours";
import { ReservationsCalendar, type CalendarView } from "./reservations-calendar";

export default async function ReservationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { access } = await requireFeatureAccess(slug, "reservations", "VIEW");
  const view: CalendarView = sp.view === "day" || sp.view === "week" ? sp.view : "timeline";

  const restaurant = await prisma.restaurant.findUniqueOrThrow({ where: { slug } });
  // Anchored at noon so a date param is unambiguously within the intended
  // calendar day once viewed in the restaurant's timezone.
  const date = sp.date ? zonedDateTimeToUtc(sp.date, "12:00", restaurant.timezone) : new Date();
  const { start, end } = view === "week"
    ? getWeekRange(date, restaurant.timezone)
    : getDayRange(date, restaurant.timezone);

  // Status and search filtering happen client-side in ReservationsCalendar --
  // the toolbar's status chips need the true count for a status even while
  // it's filtered out, which a server-side WHERE can't give us.
  const reservations = await prisma.reservation.findMany({
    where: {
      restaurantId: restaurant.id,
      startsAt: { gte: start, lt: end },
    },
    include: { customer: { select: { name: true, email: true, phone: true } }, table: { select: { number: true } } },
    orderBy: { startsAt: "asc" },
  });

  const tables = sortTablesByNumber(await prisma.table.findMany({ where: { restaurantId: restaurant.id } }));
  const floors = await prisma.floor.findMany({ where: { restaurantId: restaurant.id }, orderBy: { order: "asc" } });
  const businessHours = await prisma.businessHours.findMany({ where: { restaurantId: restaurant.id } });
  const dayHours = getHoursForDay(businessHours, getZonedDayOfWeek(date, restaurant.timezone));

  return (
    <ReservationsCalendar
      slug={slug}
      view={view}
      date={view === "week" ? start : date}
      reservations={reservations}
      tables={tables}
      floors={floors}
      dayHours={dayHours}
      defaultDurationMinutes={restaurant.defaultReservationDurationMinutes}
      timeZone={restaurant.timezone}
      canEdit={access === "EDIT"}
    />
  );
}
