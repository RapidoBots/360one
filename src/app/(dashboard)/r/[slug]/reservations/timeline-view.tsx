"use client";

import { cn } from "@/lib/utils";
import type { ReservationListItem } from "./day-view";

const DAY_START_HOUR = 8;
const DAY_END_HOUR = 23;
const TOTAL_MINUTES = (DAY_END_HOUR - DAY_START_HOUR) * 60;

export function TimelineView({
  reservations,
  tables,
  onReservationClick,
}: {
  reservations: ReservationListItem[];
  tables: { id: string; number: string }[];
  onReservationClick: (id: string) => void;
}) {
  if (tables.length === 0) {
    return <p className="py-16 text-center text-base text-muted-foreground">Add a table to see the timeline.</p>;
  }

  function offsetPercent(startsAt: Date) {
    const minutesSinceStart = (startsAt.getHours() - DAY_START_HOUR) * 60 + startsAt.getMinutes();
    return Math.max(0, Math.min(100, (minutesSinceStart / TOTAL_MINUTES) * 100));
  }
  function widthPercent(durationMinutes: number) {
    return Math.max(2, (durationMinutes / TOTAL_MINUTES) * 100);
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      {tables.map((table) => {
        const tableReservations = reservations.filter((r) => r.tableId === table.id);
        return (
          <div key={table.id} className="flex border-b border-border last:border-b-0">
            <div className="w-24 shrink-0 border-r border-border p-3 text-base font-medium">
              Table {table.number}
            </div>
            <div className="relative h-14 min-w-[600px] flex-1">
              {tableReservations.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onReservationClick(r.id)}
                  className={cn(
                    "absolute top-1/2 h-10 -translate-y-1/2 truncate rounded-lg bg-primary/15 px-2 text-left text-xs font-medium text-primary hover:bg-primary/25"
                  )}
                  style={{ left: `${offsetPercent(r.startsAt)}%`, width: `${widthPercent(r.durationMinutes)}%` }}
                >
                  {r.customer.name}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
