"use client";

import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_ACCENT } from "./reservation-badge";
import type { ReservationListItem } from "./day-view";

const SLOT_MINUTES = 30;
const LABEL_COLUMN = "6rem";

function formatHour(hour: number) {
  // hour can be 24 (the end-of-day boundary mark) -- wrap it back to
  // midnight for display rather than showing a bogus "24:00".
  const h24 = hour % 24;
  const period = h24 >= 12 ? "PM" : "AM";
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:00 ${period}`;
}

export function TimelineView({
  reservations,
  tables,
  date,
  dayHours,
  onReservationClick,
  onSlotClick,
}: {
  reservations: ReservationListItem[];
  tables: { id: string; number: string }[];
  date: Date;
  dayHours: { isOpen: boolean; startHour: number; endHour: number };
  onReservationClick: (id: string) => void;
  onSlotClick: (tableId: string, time: string) => void;
}) {
  if (tables.length === 0) {
    return <p className="py-16 text-center text-base text-muted-foreground">Add a table to see the timeline.</p>;
  }
  if (!dayHours.isOpen) {
    return <p className="py-16 text-center text-base text-muted-foreground">Closed on this day.</p>;
  }

  const { startHour, endHour } = dayHours;
  const totalMinutes = (endHour - startHour) * 60;

  function minutesToOffsetPercent(minutesSinceStart: number) {
    return Math.max(0, Math.min(100, (minutesSinceStart / totalMinutes) * 100));
  }

  const now = new Date();
  const nowMinutes = (now.getHours() - startHour) * 60 + now.getMinutes();
  // Only show the current-time line when "now" actually falls within the
  // visible hour range for today -- otherwise it has nothing meaningful to
  // point at.
  const showNowLine = date.toDateString() === now.toDateString() && nowMinutes >= 0 && nowMinutes <= totalMinutes;
  const nowPercent = minutesToOffsetPercent(nowMinutes);
  const nowLabel = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  const hourMarks = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

  function offsetPercent(startsAt: Date) {
    const minutesSinceStart = (startsAt.getHours() - startHour) * 60 + startsAt.getMinutes();
    return minutesToOffsetPercent(minutesSinceStart);
  }
  function widthPercent(durationMinutes: number) {
    return Math.max(2, (durationMinutes / totalMinutes) * 100);
  }

  function handleTrackClick(tableId: string, e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const rawMinutes = startHour * 60 + percent * totalMinutes;
    const snapped = Math.round(rawMinutes / 30) * 30;
    const hour = Math.floor(snapped / 60);
    const minute = snapped % 60;
    onSlotClick(tableId, `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
  }

  const slotCells = Array.from({ length: totalMinutes / SLOT_MINUTES }, (_, i) => i);
  // Widget bookings (and any reservation without a table yet) can't render
  // in a per-table row -- surface them in their own row instead of letting
  // them silently disappear from the default view.
  const unassignedReservations = reservations.filter((r) => r.tableId === null);

  return (
    <div className="relative overflow-x-auto rounded-[5px] border border-border">
      <div className="relative flex h-14 border-b border-border bg-muted/40 text-xs font-medium text-muted-foreground">
        <div style={{ width: LABEL_COLUMN }} className="flex shrink-0 items-center p-3">
          Tables
        </div>
        <div className="relative min-w-[1600px] flex-1 overflow-hidden">
          {hourMarks.map((hour) => (
            <span
              key={hour}
              className="absolute top-3 pl-1.5 whitespace-nowrap"
              style={{ left: `${minutesToOffsetPercent((hour - startHour) * 60)}%` }}
            >
              {formatHour(hour)}
            </span>
          ))}
          {showNowLine && (
            <div className="pointer-events-none absolute inset-y-0 z-10" style={{ left: `${nowPercent}%` }}>
              <div className="h-full w-px bg-destructive" />
              <span className="absolute top-8 -translate-x-1/2 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-medium whitespace-nowrap text-destructive-foreground">
                {nowLabel}
              </span>
            </div>
          )}
        </div>
      </div>

      {unassignedReservations.length > 0 && (
        <div className="flex border-b border-border bg-amber-500/5">
          <div
            style={{ width: LABEL_COLUMN }}
            className="shrink-0 border-r border-border p-3 text-base font-medium text-amber-700"
          >
            Unassigned
          </div>
          <div className="relative h-20 min-w-[1600px] flex-1">
            {unassignedReservations.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onReservationClick(r.id)}
                className={cn(
                  "absolute top-1/2 z-10 h-14 -translate-y-1/2 truncate rounded-[5px] border-l-4 bg-background px-3 py-1.5 text-left shadow-sm hover:shadow-md",
                  STATUS_ACCENT[r.status]
                )}
                style={{ left: `${offsetPercent(r.startsAt)}%`, width: `${widthPercent(r.durationMinutes)}%` }}
              >
                <p className="truncate text-sm font-semibold">{r.customer.name}</p>
                <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <Clock className="h-3 w-3 shrink-0" />
                  {r.startsAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </p>
              </button>
            ))}
          </div>
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
              className="relative h-20 min-w-[1600px] flex-1 cursor-pointer"
              onClick={(e) => handleTrackClick(table.id, e)}
            >
              <div
                className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(45deg,var(--muted)_0px,var(--muted)_1px,transparent_1px,transparent_9px)]"
              />
              <div className="absolute inset-0 flex">
                {slotCells.map((slot) => (
                  <div
                    key={slot}
                    className={cn(
                      "h-full flex-1 border-r last:border-r-0",
                      slot % 2 === 1 ? "border-border/60" : "border-border/25"
                    )}
                  />
                ))}
              </div>

              {showNowLine && (
                <div
                  className="pointer-events-none absolute inset-y-0 z-10 w-px bg-destructive"
                  style={{ left: `${nowPercent}%` }}
                />
              )}

              {tableReservations.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReservationClick(r.id);
                  }}
                  className={cn(
                    "absolute top-1/2 z-10 h-14 -translate-y-1/2 truncate rounded-[5px] border-l-4 bg-background px-3 py-1.5 text-left shadow-sm hover:shadow-md",
                    STATUS_ACCENT[r.status]
                  )}
                  style={{ left: `${offsetPercent(r.startsAt)}%`, width: `${widthPercent(r.durationMinutes)}%` }}
                >
                  <p className="truncate text-sm font-semibold">{r.customer.name}</p>
                  <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <Clock className="h-3 w-3 shrink-0" />
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
