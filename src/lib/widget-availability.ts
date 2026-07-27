import { doesOverlap, type TimeRange } from "@/lib/reservation-conflicts";
import { getHoursForDay, type DayHours } from "@/lib/business-hours";
import { zonedDateTimeToUtc } from "@/lib/reservation-dates";

const SLOT_MINUTES = 15;

export type AvailabilityTable = { id: string; capacity: number };
export type AvailabilityReservation = { tableId: string | null } & TimeRange;

export function getAvailableSlots(
  tables: AvailabilityTable[],
  reservations: AvailabilityReservation[],
  input: {
    partySize: number;
    date: string; // YYYY-MM-DD
    businessHours: DayHours[];
    durationMinutes: number;
    timeZone: string;
  }
): string[] {
  const fitting = tables.filter((t) => t.capacity >= input.partySize);
  if (fitting.length === 0) return [];

  // A fixed Y-M-D string's day-of-week is the same regardless of timezone --
  // parsed and read as UTC here purely to make that independence explicit,
  // not because it needs to match the restaurant's zone.
  const dayOfWeek = new Date(`${input.date}T00:00:00Z`).getUTCDay();
  const { isOpen, startHour, endHour } = getHoursForDay(input.businessHours, dayOfWeek);
  if (!isOpen) return [];

  const slots: string[] = [];
  const dayStart = startHour * 60;
  const dayEnd = endHour * 60;

  for (let minutes = dayStart; minutes + input.durationMinutes <= dayEnd; minutes += SLOT_MINUTES) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    const startsAt = zonedDateTimeToUtc(input.date, time, input.timeZone);

    const hasFreeTable = fitting.some((t) => {
      const conflict = reservations.some(
        (r) => r.tableId === t.id && doesOverlap(r, { startsAt, durationMinutes: input.durationMinutes })
      );
      return !conflict;
    });

    if (hasFreeTable) slots.push(time);
  }

  return slots;
}
