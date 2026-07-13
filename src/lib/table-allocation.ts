import { doesOverlap, type TimeRange } from "@/lib/reservation-conflicts";

export type AllocationTable = { id: string; capacity: number };
export type AllocationReservation = { tableId: string | null } & TimeRange;

export function recommendTable(
  tables: AllocationTable[],
  reservations: AllocationReservation[],
  input: { partySize: number; startsAt: Date; durationMinutes: number }
): string | null {
  const fitting = tables.filter((t) => t.capacity >= input.partySize);

  const available = fitting.filter((t) => {
    const conflict = reservations.some(
      (r) =>
        r.tableId === t.id &&
        doesOverlap(r, { startsAt: input.startsAt, durationMinutes: input.durationMinutes })
    );
    return !conflict;
  });

  if (available.length === 0) return null;
  return [...available].sort((a, b) => a.capacity - b.capacity)[0].id;
}
