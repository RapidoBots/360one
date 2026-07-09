"use client";

import { ReservationBadge } from "./reservation-badge";
import type { ReservationStatus } from "@/generated/prisma/client";

export type ReservationListItem = {
  id: string;
  startsAt: Date;
  durationMinutes: number;
  partySize: number;
  status: ReservationStatus;
  specialRequests: string | null;
  tableId: string | null;
  table: { number: string } | null;
  customer: { name: string; email: string | null; phone: string | null };
};

export function DayView({
  reservations,
  onReservationClick,
}: {
  reservations: ReservationListItem[];
  onReservationClick: (id: string) => void;
}) {
  const sorted = [...reservations].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  if (sorted.length === 0) {
    return <p className="py-16 text-center text-base text-muted-foreground">No reservations for this day.</p>;
  }

  return (
    <ul className="divide-y divide-border rounded-[5px] border border-border">
      {sorted.map((r) => (
        <li
          key={r.id}
          onClick={() => onReservationClick(r.id)}
          className="flex cursor-pointer items-center justify-between gap-4 p-4 hover:bg-muted"
        >
          <div className="flex items-center gap-4">
            <span className="w-16 shrink-0 font-mono text-base">
              {r.startsAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
            <div>
              <p className="font-medium">{r.customer.name}</p>
              <p className="text-base text-muted-foreground">
                Party of {r.partySize}
                {r.table ? ` · Table ${r.table.number}` : ""}
              </p>
            </div>
          </div>
          <ReservationBadge status={r.status} />
        </li>
      ))}
    </ul>
  );
}
