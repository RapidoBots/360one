import type { ReservationStatus } from "@/generated/prisma/client";

export type TableFloorStatus = "AVAILABLE" | "RESERVED_SOON" | "SEATED";

// ponytail: hardcoded window; a per-restaurant setting is Phase 8's job.
const RESERVED_SOON_WINDOW_MINUTES = 30;

export type TableStatusReservation = {
  id: string;
  tableId: string | null;
  startsAt: Date;
  durationMinutes: number;
  status: ReservationStatus;
  partySize: number;
  customerName: string;
};

export function getTableStatus(
  tableId: string,
  reservations: TableStatusReservation[],
  now: Date
): { status: TableFloorStatus; reservation: TableStatusReservation | null } {
  const tableReservations = reservations.filter((r) => r.tableId === tableId);

  const seated = tableReservations.find((r) => r.status === "SEATED");
  if (seated) return { status: "SEATED", reservation: seated };

  // A CONFIRMED reservation counts as "reserved soon" from 30 minutes before
  // its start through its full expected duration -- covers both an upcoming
  // booking and a late arrival that hasn't been marked SEATED yet, without
  // blocking the table forever once its window has fully passed.
  const soon = tableReservations.find((r) => {
    if (r.status !== "CONFIRMED") return false;
    const windowStart = r.startsAt.getTime() - RESERVED_SOON_WINDOW_MINUTES * 60_000;
    const windowEnd = r.startsAt.getTime() + r.durationMinutes * 60_000;
    return now.getTime() >= windowStart && now.getTime() <= windowEnd;
  });
  if (soon) return { status: "RESERVED_SOON", reservation: soon };

  return { status: "AVAILABLE", reservation: null };
}
