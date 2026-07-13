"use client";

import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_ACCENT } from "./reservation-badge";
import type { ReservationListItem } from "./day-view";

// ponytail: hardcoded hours for now, per-restaurant hours are a
// Settings-phase feature (Phase 8).
const DAY_START_HOUR = 7;
const DAY_END_HOUR = 23;
const SLOT_MINUTES = 30;
const TOTAL_MINUTES = (DAY_END_HOUR - DAY_START_HOUR) * 60;
const LABEL_COLUMN = "6rem";

function minutesToOffsetPercent(minutesSinceStart: number) {
  return Math.max(0, Math.min(100, (minutesSinceStart / TOTAL_MINUTES) * 100));
}

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

  const slotCells = Array.from({ length: TOTAL_MINUTES / SLOT_MINUTES }, (_, i) => i);

  return (
    <div className="relative overflow-x-auto rounded-[5px] border border-border">
      <div className="relative flex h-14 border-b border-border bg-muted/40 text-xs font-medium text-muted-foreground">
        <div style={{ width: LABEL_COLUMN }} className="flex shrink-0 items-center p-3">
          Tables
        </div>
        {/* overflow-hidden so a label's text never inflates the outer
            overflow-x-auto container's scrollWidth -- an anchored-right
            label pushing text left instead (like the old last-mark special
            case did) just collides with its neighbor instead, so clipping
            is the simpler, uniform fix for every mark. */}
        <div className="relative min-w-[1600px] flex-1 overflow-hidden">
          {hourMarks.map((hour) => (
            <span
              key={hour}
              className="absolute top-3 pl-1.5 whitespace-nowrap"
              style={{ left: `${minutesToOffsetPercent((hour - DAY_START_HOUR) * 60)}%` }}
            >
              {formatHour(hour)}
            </span>
          ))}
          {/* Positioned as a percent of THIS track div (same box the hour
              labels use), not the outer scroll container -- that div can be
              wider than the outer container's visible width (it has its own
              min-width and grows via flex-1), so computing this line's
              position against the outer container's 100% put it at the
              wrong pixel offset whenever horizontal scrolling was active. */}
          {showNowLine && (
            <div className="pointer-events-none absolute inset-y-0 z-10" style={{ left: `${nowPercent}%` }}>
              <div className="h-full w-px bg-destructive" />
              {/* Sits in its own band below the hour labels (top-3..top-6ish) so
                  the dynamic time never overlaps the hardcoded hour text. */}
              <span className="absolute top-8 -translate-x-1/2 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-medium whitespace-nowrap text-destructive-foreground">
                {nowLabel}
              </span>
            </div>
          )}
        </div>
      </div>

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
              {/* One continuous texture spanning the whole track, rather than
                  a separate repeating-gradient per slot cell -- per-cell
                  gradients each restart their own phase at that cell's edge,
                  so at odd cell widths/scroll offsets neighboring cells can
                  look out of sync (some textured, some blank). */}
              <div
                className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(45deg,var(--muted)_0px,var(--muted)_1px,transparent_1px,transparent_9px)]"
              />
              <div className="absolute inset-0 flex">
                {slotCells.map((slot) => (
                  <div
                    key={slot}
                    className={cn(
                      "h-full flex-1 border-r last:border-r-0",
                      // Odd slots end on the hour (major boundary); even slots end
                      // on the half-hour (minor boundary) -- a subtler line.
                      slot % 2 === 1 ? "border-border/60" : "border-border/25"
                    )}
                  />
                ))}
              </div>

              {/* Same track-relative positioning as the header's now-line
                  segment -- every row shares the identical min-w/flex-1
                  sizing, so these line up into what reads as one continuous
                  line down the page. */}
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
