"use client";

import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_ACCENT } from "./reservation-badge";
import type { ReservationListItem } from "./day-view";

const DAY_START_HOUR = 8;
const DAY_END_HOUR = 23;
const TOTAL_MINUTES = (DAY_END_HOUR - DAY_START_HOUR) * 60;
const LABEL_COLUMN = "6rem";

function minutesToOffsetPercent(minutesSinceStart: number) {
  return Math.max(0, Math.min(100, (minutesSinceStart / TOTAL_MINUTES) * 100));
}

function trackLeftStyle(percent: number) {
  return { left: `calc(${LABEL_COLUMN} + (100% - ${LABEL_COLUMN}) * ${percent / 100})` };
}

function formatHour(hour: number) {
  const period = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:00 ${period}`;
}

export function TimelineView({
  reservations,
  tables,
  date,
  onReservationClick,
  onSlotClick,
}: {
  reservations: ReservationListItem[];
  tables: { id: string; number: string }[];
  date: Date;
  onReservationClick: (id: string) => void;
  onSlotClick: (tableId: string, time: string) => void;
}) {
  if (tables.length === 0) {
    return <p className="py-16 text-center text-base text-muted-foreground">Add a table to see the timeline.</p>;
  }

  const now = new Date();
  const nowMinutes = (now.getHours() - DAY_START_HOUR) * 60 + now.getMinutes();
  // Only show the current-time line when "now" actually falls within the
  // visible hour range for today -- otherwise it has nothing meaningful to
  // point at and previously just pinned to the left edge, which read as a
  // stray line rather than "it's currently outside business hours."
  const showNowLine = date.toDateString() === now.toDateString() && nowMinutes >= 0 && nowMinutes <= TOTAL_MINUTES;
  const nowPercent = minutesToOffsetPercent(nowMinutes);
  const nowLabel = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  const hourMarks = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => DAY_START_HOUR + i);

  function offsetPercent(startsAt: Date) {
    const minutesSinceStart = (startsAt.getHours() - DAY_START_HOUR) * 60 + startsAt.getMinutes();
    return minutesToOffsetPercent(minutesSinceStart);
  }
  function widthPercent(durationMinutes: number) {
    return Math.max(2, (durationMinutes / TOTAL_MINUTES) * 100);
  }

  function handleTrackClick(tableId: string, e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const rawMinutes = DAY_START_HOUR * 60 + percent * TOTAL_MINUTES;
    const snapped = Math.round(rawMinutes / 30) * 30;
    const hour = Math.floor(snapped / 60);
    const minute = snapped % 60;
    onSlotClick(tableId, `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
  }

  const hourCells = hourMarks.slice(0, -1);

  return (
    <div className="relative overflow-x-auto rounded-[5px] border border-border">
      <div className="flex border-b border-border bg-muted/40 text-xs font-medium text-muted-foreground">
        <div style={{ width: LABEL_COLUMN }} className="shrink-0 p-3">
          Tables
        </div>
        <div className="relative min-w-[600px] flex-1">
          {hourMarks.map((hour) => (
            <span
              key={hour}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap"
              style={trackLeftStyle(minutesToOffsetPercent((hour - DAY_START_HOUR) * 60))}
            >
              {formatHour(hour)}
            </span>
          ))}
        </div>
      </div>

      {showNowLine && (
        <div className="pointer-events-none absolute inset-y-0 z-10" style={trackLeftStyle(nowPercent)}>
          <div className="h-full w-px bg-destructive" />
          <span className="absolute -top-2 -translate-x-1/2 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-medium whitespace-nowrap text-destructive-foreground">
            {nowLabel}
          </span>
        </div>
      )}

      {tables.map((table) => {
        const tableReservations = reservations.filter((r) => r.tableId === table.id);
        return (
          <div key={table.id} className="flex border-b border-border last:border-b-0">
            <div style={{ width: LABEL_COLUMN }} className="shrink-0 border-r border-border p-3 text-base font-medium">
              Table {table.number}
            </div>
            <div
              className="relative h-16 min-w-[600px] flex-1 cursor-pointer"
              onClick={(e) => handleTrackClick(table.id, e)}
            >
              <div className="absolute inset-0 flex">
                {hourCells.map((hour) => (
                  <div
                    key={hour}
                    className="h-full flex-1 border-r border-border/60 bg-[repeating-linear-gradient(45deg,var(--muted)_0px,var(--muted)_1px,transparent_1px,transparent_9px)] last:border-r-0"
                  />
                ))}
              </div>

              {tableReservations.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReservationClick(r.id);
                  }}
                  className={cn(
                    "absolute top-1/2 z-10 h-12 -translate-y-1/2 truncate rounded-lg border-l-4 bg-background px-2.5 py-1 text-left shadow-sm hover:shadow-md",
                    STATUS_ACCENT[r.status]
                  )}
                  style={{ left: `${offsetPercent(r.startsAt)}%`, width: `${widthPercent(r.durationMinutes)}%` }}
                >
                  <p className="truncate text-xs font-semibold">{r.customer.name}</p>
                  <p className="flex items-center gap-1 truncate text-[10px] text-muted-foreground">
                    <Clock className="h-2.5 w-2.5 shrink-0" />
                    {r.startsAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </p>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
