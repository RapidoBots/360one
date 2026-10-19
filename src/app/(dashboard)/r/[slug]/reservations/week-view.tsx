"use client";

import { cn } from "@/lib/utils";
import { formatZonedTime, toLocalDateInput } from "@/lib/reservation-dates";
import { STATUS_COLORS } from "./reservation-badge";
import type { ReservationListItem } from "./day-view";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_MS = 24 * 60 * 60 * 1000;

export function WeekView({
  reservations,
  allReservations,
  weekStart,
  selectedDate,
  timeZone,
  onDayClick,
  onReservationClick,
}: {
  /** Status/search-filtered reservations for the week -- drives the chips shown in each column. */
  reservations: ReservationListItem[];
  /** Unfiltered reservations for the week -- drives each column header's true counts. */
  allReservations: ReservationListItem[];
  weekStart: Date;
  selectedDate: Date;
  timeZone: string;
  onDayClick: (date: Date) => void;
  onReservationClick: (id: string) => void;
}) {
  const formatTime = (d: Date) => formatZonedTime(d, timeZone);
  // weekStart is local midnight (in `timeZone`) as a UTC instant -- adding
  // whole days in UTC keeps each entry at local midnight for that same zone,
  // rather than drifting across a calendar day boundary in the server/
  // browser's own timezone (date.setDate() reads/writes in THAT timezone).
  const days = Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * DAY_MS));
  const todayStr = toLocalDateInput(new Date(), timeZone);
  const selectedStr = toLocalDateInput(selectedDate, timeZone);

  return (
    <section className="overflow-hidden rounded-[20px] border border-line-card bg-white shadow-card">
      <div className="overflow-x-auto">
        <div className="grid min-w-[1204px] grid-cols-7">
          {days.map((day, i) => {
            const dayStr = toLocalDateInput(day, timeZone);
            const isToday = dayStr === todayStr;
            const isSelected = dayStr === selectedStr;
            const dayItems = reservations
              .filter((r) => toLocalDateInput(r.startsAt, timeZone) === dayStr)
              .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
            const dayAll = allReservations.filter(
              (r) => toLocalDateInput(r.startsAt, timeZone) === dayStr && r.status !== "CANCELLED"
            );
            const guestCount = dayAll.reduce((sum, r) => sum + r.partySize, 0);

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "flex flex-col border-r border-line-divider last:border-r-0",
                  isToday ? "bg-primary/[0.04]" : i > 4 ? "bg-[#FBFBFE]" : "bg-white"
                )}
              >
                <button
                  type="button"
                  onClick={() => onDayClick(day)}
                  aria-label={`Open ${DOW[i]} ${Number(dayStr.slice(8))} in day view`}
                  className="flex h-[84px] items-center gap-3 border-b border-line-card bg-surface-footer px-4 text-left hover:bg-[#F1F3F9]"
                >
                  <span
                    className={cn(
                      "flex size-11 shrink-0 flex-col items-center justify-center rounded-[14px] leading-tight",
                      isToday ? "bg-primary text-white" : isSelected ? "bg-primary/10 text-primary" : "bg-[#E9ECF5] text-[#475569]"
                    )}
                  >
                    <span className="text-[10.5px] font-bold tracking-wide uppercase">{DOW[i]}</span>
                    <span className="text-[17px] font-extrabold">{Number(dayStr.slice(8))}</span>
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[13.5px] font-bold text-ink">
                      {dayAll.length} {dayAll.length === 1 ? "reservation" : "reservations"}
                    </span>
                    <span className="text-[12.5px] text-ink-muted">{guestCount} guests</span>
                  </span>
                </button>

                <div className="flex min-h-[360px] flex-col gap-2 p-2.5">
                  {dayItems.map((r) => {
                    const c = STATUS_COLORS[r.status];
                    const cancelled = r.status === "CANCELLED";
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => onReservationClick(r.id)}
                        aria-label={`${r.customer.name}, ${formatTime(r.startsAt)}, party of ${r.partySize}`}
                        className="w-full rounded-[10px] border-0 border-l-4 px-2.5 py-2 text-left opacity-100 shadow-sm"
                        style={{ borderLeftColor: c.bar, backgroundColor: c.bg, opacity: cancelled ? 0.75 : 1 }}
                      >
                        <span className="block text-[11.5px] font-bold" style={{ color: c.text }}>
                          {formatTime(r.startsAt)} · {r.partySize} {r.partySize === 1 ? "guest" : "guests"}
                        </span>
                        <span className={cn("block truncate text-[13px] font-bold text-ink", cancelled && "line-through")}>
                          {r.customer.name}
                        </span>
                        <span className="block text-[11.5px] font-semibold text-ink-muted">
                          {r.table ? `Table ${r.table.number}` : "Unassigned"}
                        </span>
                      </button>
                    );
                  })}
                  {dayItems.length === 0 && (
                    <p className="mt-2 text-center text-[13px] text-ink-placeholder">No reservations</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
