import { doesOverlap, type TimeRange } from "@/lib/reservation-conflicts";
import { DAY_START_HOUR, DAY_END_HOUR } from "@/lib/business-hours";

const SLOT_MINUTES = 15;
const DURATION_MINUTES = 90;

export type AvailabilityTable = { id: string; capacity: number };
export type AvailabilityReservation = { tableId: string | null } & TimeRange;

export function getAvailableSlots(
  tables: AvailabilityTable[],
  reservations: AvailabilityReservation[],
  input: { partySize: number; date: string } // date: YYYY-MM-DD
): string[] {
  const fitting = tables.filter((t) => t.capacity >= input.partySize);
  if (fitting.length === 0) return [];

  const slots: string[] = [];
  const dayStart = DAY_START_HOUR * 60;
  const dayEnd = DAY_END_HOUR * 60;

  for (let minutes = dayStart; minutes + DURATION_MINUTES <= dayEnd; minutes += SLOT_MINUTES) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    const startsAt = new Date(`${input.date}T${time}`);

    const hasFreeTable = fitting.some((t) => {
      const conflict = reservations.some(
        (r) => r.tableId === t.id && doesOverlap(r, { startsAt, durationMinutes: DURATION_MINUTES })
      );
      return !conflict;
    });

    if (hasFreeTable) slots.push(time);
  }

  return slots;
}
