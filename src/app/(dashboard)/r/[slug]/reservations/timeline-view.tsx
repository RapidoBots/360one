"use client";

import { AlertTriangle } from "lucide-react";
import { toZonedTime } from "date-fns-tz";
import { cn } from "@/lib/utils";
import { formatZonedTime } from "@/lib/reservation-dates";
import { STATUS_COLORS, STATUS_LABELS } from "./reservation-badge";
import type { ReservationListItem } from "./day-view";

const LABEL_WIDTH = 140;
const HOUR_WIDTH = 120;
const ROW_HEIGHT = 64;
const LANE_MIN_HEIGHT = 72;

function formatHour(hour: number) {
  const h24 = hour % 24;
  const period = h24 >= 12 ? "PM" : "AM";
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:00 ${period}`;
}
function formatClock(minutesOfDay: number) {
  const h24 = Math.floor(minutesOfDay / 60) % 24;
  const m = minutesOfDay % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(m).padStart(2, "0")} ${period}`;
}
function minutesOfDay(d: Date, timeZone: string) {
  const zoned = toZonedTime(d, timeZone);
  return zoned.getHours() * 60 + zoned.getMinutes();
}

// Greedy row-packing: reservations in the same lane that overlap in time
// stack into sub-rows instead of rendering on top of each other.
function packLane(items: { id: string; start: number; dur: number }[]) {
  const sorted = [...items].sort((a, b) => a.start - b.start);
  const rowEnds: number[] = [];
  const rowOf = new Map<string, number>();
  for (const r of sorted) {
    let row = rowEnds.findIndex((end) => end <= r.start);
    if (row === -1) {
      row = rowEnds.length;
      rowEnds.push(0);
    }
    rowEnds[row] = r.start + r.dur;
    rowOf.set(r.id, row);
  }
  return { rowOf, rowCount: Math.max(1, rowEnds.length) };
}

function blockGeometry(start: number, dur: number, rangeStartMin: number, rangeEndMin: number) {
  const clampedStart = Math.max(start, rangeStartMin);
  const clampedEnd = Math.min(start + dur, rangeEndMin);
  if (clampedEnd <= clampedStart) return null;
  const left = ((clampedStart - rangeStartMin) / 60) * HOUR_WIDTH + 2;
  const width = Math.max(8, ((clampedEnd - clampedStart) / 60) * HOUR_WIDTH - 4);
  return { left, width };
}

function Lane({
  label,
  isUnassigned,
  count,
  items,
  rangeStartMin,
  rangeEndMin,
  zebra,
  timeZone,
  tableId,
  onReservationClick,
  onSlotClick,
}: {
  label: string;
  isUnassigned: boolean;
  count?: number;
  items: ReservationListItem[];
  rangeStartMin: number;
  rangeEndMin: number;
  zebra: boolean;
  timeZone: string;
  tableId: string | null;
  onReservationClick: (id: string) => void;
  onSlotClick?: (tableId: string, time: string) => void;
}) {
  const { rowOf, rowCount } = packLane(items.map((r) => ({ id: r.id, start: minutesOfDay(r.startsAt, timeZone), dur: r.durationMinutes })));
  const height = Math.max(LANE_MIN_HEIGHT, 8 + rowCount * ROW_HEIGHT);
  const gridStrong = isUnassigned ? "#FCE9B0" : "#E6E9F2";
  const gridSoft = isUnassigned ? "#FDF0C7" : "#F1F3F9";

  return (
    <div
      className="flex border-b"
      style={{ height, backgroundColor: isUnassigned ? "#FFFBEB" : zebra ? "#FBFBFE" : "#FFFFFF", borderColor: isUnassigned ? "#FDE68A" : "#EEF0F6" }}
    >
      <div
        className="sticky left-0 z-[2] flex shrink-0 items-center gap-2 border-r border-line-card py-0 pr-4 pl-5 text-sm font-bold"
        style={{ width: LABEL_WIDTH, backgroundColor: isUnassigned ? "#FFF7DB" : zebra ? "#FBFBFE" : "#FFFFFF", color: isUnassigned ? "#92400E" : "#0F172A" }}
      >
        {isUnassigned && <AlertTriangle className="size-4 shrink-0" />}
        <span className="truncate">{label}</span>
        {isUnassigned && (
          <span className="min-w-5 shrink-0 rounded-full bg-[#FDE68A] px-1.5 py-0.5 text-center text-[11.5px] font-extrabold text-[#92400E]">
            {count}
          </span>
        )}
      </div>
      <div
        className={cn("relative shrink-0", onSlotClick && tableId && "cursor-pointer")}
        style={{
          width: ((rangeEndMin - rangeStartMin) / 60) * HOUR_WIDTH,
          backgroundImage: `linear-gradient(to right, ${gridStrong} 1px, transparent 1px), linear-gradient(to right, ${gridSoft} 1px, transparent 1px)`,
          backgroundSize: `${HOUR_WIDTH}px 100%, ${HOUR_WIDTH / 2}px 100%`,
        }}
        onClick={(e) => {
          if (!onSlotClick || !tableId) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          const rawMinutes = rangeStartMin + percent * (rangeEndMin - rangeStartMin);
          const snapped = Math.round(rawMinutes / 30) * 30;
          onSlotClick(tableId, `${String(Math.floor(snapped / 60)).padStart(2, "0")}:${String(snapped % 60).padStart(2, "0")}`);
        }}
      >
        {items.map((r) => {
          const start = minutesOfDay(r.startsAt, timeZone);
          const geo = blockGeometry(start, r.durationMinutes, rangeStartMin, rangeEndMin);
          if (!geo) return null;
          const c = STATUS_COLORS[r.status];
          const cancelled = r.status === "CANCELLED";
          const row = rowOf.get(r.id) ?? 0;
          const endsAt = new Date(r.startsAt.getTime() + r.durationMinutes * 60000);
          const timeLabel = `${formatZonedTime(r.startsAt, timeZone)}–${formatZonedTime(endsAt, timeZone)}`;
          return (
            <button
              key={r.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onReservationClick(r.id);
              }}
              aria-label={`${r.customer.name}, ${timeLabel}, ${STATUS_LABELS[r.status]}`}
              className="absolute flex h-14 flex-col justify-center gap-0.5 overflow-hidden rounded-[10px] border-0 border-l-4 py-2 pr-2.5 pl-3 text-left shadow-sm transition-transform hover:-translate-y-px"
              style={{
                left: geo.left,
                top: 8 + row * ROW_HEIGHT,
                width: geo.width,
                backgroundColor: c.bg,
                borderLeftColor: c.bar,
                opacity: cancelled ? 0.75 : 1,
              }}
            >
              <span className={cn("truncate text-[13px] font-bold text-ink", cancelled && "line-through")}>{r.customer.name}</span>
              <span className="truncate text-[11.5px] font-semibold" style={{ color: c.text }}>
                {timeLabel} · {r.partySize} {r.partySize === 1 ? "guest" : "guests"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TimelineView({
  reservations,
  allReservations,
  tables,
  date,
  dayHours,
  timeZone,
  onReservationClick,
  onSlotClick,
}: {
  reservations: ReservationListItem[];
  allReservations: ReservationListItem[];
  tables: { id: string; number: string }[];
  date: Date;
  dayHours: { isOpen: boolean; startHour: number; endHour: number };
  timeZone: string;
  onReservationClick: (id: string) => void;
  onSlotClick?: (tableId: string, time: string) => void;
}) {
  if (tables.length === 0) {
    return <p className="py-16 text-center text-base text-muted-foreground">Add a table to see the timeline.</p>;
  }
  if (!dayHours.isOpen) {
    return <p className="py-16 text-center text-base text-muted-foreground">Closed on this day.</p>;
  }

  const { startHour, endHour } = dayHours;
  const rangeStartMin = startHour * 60;
  const rangeEndMin = endHour * 60;
  const hourMarks = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

  const now = new Date();
  const isToday = toZonedTime(date, timeZone).toDateString() === toZonedTime(now, timeZone).toDateString();
  const nowMin = minutesOfDay(now, timeZone);
  const showNow = isToday && nowMin >= rangeStartMin && nowMin <= rangeEndMin;

  const unassigned = reservations.filter((r) => r.tableId === null);
  const unassignedCount = allReservations.filter((r) => r.tableId === null && r.status !== "CANCELLED").length;

  const empty = allReservations.length === 0;
  const noMatch = !empty && reservations.length === 0;

  return (
    <section className="overflow-hidden rounded-[20px] border border-line-card bg-white shadow-card">
      <div className="overflow-x-auto">
        <div className="relative" style={{ minWidth: LABEL_WIDTH + ((rangeEndMin - rangeStartMin) / 60) * HOUR_WIDTH }}>
          <div className="flex h-[52px] border-b border-line-card bg-surface-footer">
            <div
              className="sticky left-0 z-[3] flex shrink-0 items-center bg-surface-footer px-5 text-xs font-bold tracking-wider text-ink-muted uppercase"
              style={{ width: LABEL_WIDTH }}
            >
              Tables
            </div>
            {hourMarks.map((h) => (
              <div key={h} className="flex shrink-0 items-center px-2.5 text-xs font-semibold text-ink-muted" style={{ width: HOUR_WIDTH }}>
                {formatHour(h)}
              </div>
            ))}
          </div>

          <Lane
            label="Unassigned"
            isUnassigned
            count={unassignedCount}
            items={unassigned}
            rangeStartMin={rangeStartMin}
            rangeEndMin={rangeEndMin}
            zebra={false}
            timeZone={timeZone}
            tableId={null}
            onReservationClick={onReservationClick}
          />
          {tables.map((t, i) => (
            <Lane
              key={t.id}
              label={`Table ${t.number}`}
              isUnassigned={false}
              items={reservations.filter((r) => r.tableId === t.id)}
              rangeStartMin={rangeStartMin}
              rangeEndMin={rangeEndMin}
              zebra={i % 2 === 1}
              timeZone={timeZone}
              tableId={t.id}
              onReservationClick={onReservationClick}
              onSlotClick={onSlotClick}
            />
          ))}

          {showNow && (
            <>
              <div
                className="pointer-events-none absolute top-[52px] bottom-0 z-[4] w-[2px] bg-primary opacity-85"
                style={{ left: LABEL_WIDTH + ((nowMin - rangeStartMin) / 60) * HOUR_WIDTH }}
              />
              <div
                className="pointer-events-none absolute top-3.5 z-[5] -translate-x-1/2 rounded-full bg-primary px-2.5 py-1 text-[11.5px] font-bold whitespace-nowrap text-white shadow-[0_4px_10px_-4px_var(--primary)]"
                style={{ left: LABEL_WIDTH + ((nowMin - rangeStartMin) / 60) * HOUR_WIDTH }}
              >
                Now {formatClock(nowMin)}
              </div>
            </>
          )}
        </div>
      </div>
      {(empty || noMatch) && (
        <div className="border-t border-line-divider px-5 py-7 text-center text-sm text-ink-muted">
          {empty ? "No reservations on this day." : "No reservations match your filters."}
        </div>
      )}
    </section>
  );
}
