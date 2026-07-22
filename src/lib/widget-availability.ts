import { doesOverlap, type TimeRange } from "@/lib/reservation-conflicts";
import { getHoursForDay, type DayHours } from "@/lib/business-hours";

const SLOT_MINUTES = 15;

export type AvailabilityTable = { id: string; capacity: number };
export type AvailabilityReservation = { tableId: string | null } & TimeRange;

export function getAvailableSlots(
  tables: AvailabilityTable[],
  reservations: AvailabilityReservation[],
  input: { partySize: number; date: string; businessHours: DayHours[]; durationMinutes: number } // date: YYYY-MM-DD
): string[] {
  const fitting = tables.filter((t) => t.capacity >= input.partySize);
  if (fitting.length === 0) return [];

  const dayOfWeek = new Date(`${input.date}T00:00:00`).getDay();
  const { isOpen, startHour, endHour } = getHoursForDay(input.businessHours, dayOfWeek);
  if (!isOpen) return [];

  const slots: string[] = [];
  const dayStart = startHour * 60;
  const dayEnd = endHour * 60;

  for (let minutes = dayStart; minutes + input.durationMinutes <= dayEnd; minutes += SLOT_MINUTES) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    const startsAt = new Date(`${input.date}T${time}`);

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
