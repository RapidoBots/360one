import { doesOverlap, type TimeRange } from "@/lib/reservation-conflicts";
import { getHoursForDay, type DayHours } from "@/lib/business-hours";
import { zonedDateTimeToUtc } from "@/lib/reservation-dates";

const SLOT_MINUTES = 15;

export type AvailabilityTable = { id: string; capacity: number };
export type AvailabilityReservation = { tableId: string | null } & TimeRange;
export type SlotAvailability = { time: string; available: boolean };

function enumerateSlotTimes(startMinutes: number, endMinutes: number, durationMinutes: number): string[] {
  const times: string[] = [];
  for (let minutes = startMinutes; minutes + durationMinutes <= endMinutes; minutes += SLOT_MINUTES) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    times.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
  }
  return times;
}

// Every slot time within business hours for a date, independent of tables,
// reservations, or party size -- used by the owner's slot-blocking UI, which
// needs to offer every time regardless of whether anyone could book it.
export function getSlotTimesForDay(businessHours: DayHours[], date: string, durationMinutes: number): string[] {
  // A fixed Y-M-D string's day-of-week is the same regardless of timezone.
  const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay();
  const { isOpen, startMinutes, endMinutes } = getHoursForDay(businessHours, dayOfWeek);
  if (!isOpen) return [];
  return enumerateSlotTimes(startMinutes, endMinutes, durationMinutes);
}

// Every slot time within business hours, each tagged with whether a
// customer could actually book it (a free table exists and the owner
// hasn't blocked that time) -- used by the widget so it can grey out
// unavailable slots instead of just omitting them.
export function getAllSlotsForDay(
  tables: AvailabilityTable[],
  reservations: AvailabilityReservation[],
  input: {
    partySize: number;
    date: string;
    businessHours: DayHours[];
    durationMinutes: number;
    timeZone: string;
    blockedTimes?: string[];
    now?: Date;
  }
): SlotAvailability[] {
  const times = getSlotTimesForDay(input.businessHours, input.date, input.durationMinutes);
  const fitting = tables.filter((t) => t.capacity >= input.partySize);
  const blocked = new Set(input.blockedTimes ?? []);

  return times.map((time) => {
    const startsAt = zonedDateTimeToUtc(input.date, time, input.timeZone);
    // A slot that's already started (or passed) can't be booked, regardless
    // of table/blocked-slot state -- matters only for today, since any slot
    // on a future date is necessarily still ahead of "now".
    if (input.now && startsAt <= input.now) return { time, available: false };
    const hasFreeTable = fitting.some((t) => {
      const conflict = reservations.some(
        (r) => r.tableId === t.id && doesOverlap(r, { startsAt, durationMinutes: input.durationMinutes })
      );
      return !conflict;
    });
    return { time, available: hasFreeTable && !blocked.has(time) };
  });
}

export function getAvailableSlots(
  tables: AvailabilityTable[],
  reservations: AvailabilityReservation[],
  input: {
    partySize: number;
    date: string;
    businessHours: DayHours[];
    durationMinutes: number;
    timeZone: string;
    blockedTimes?: string[];
    now?: Date;
  }
): string[] {
  return getAllSlotsForDay(tables, reservations, input)
    .filter((s) => s.available)
    .map((s) => s.time);
}
