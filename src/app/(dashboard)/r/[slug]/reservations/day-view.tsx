"use client";

import { ChevronRight } from "lucide-react";
import { toZonedTime } from "date-fns-tz";
import { cn } from "@/lib/utils";
import { formatZonedTime } from "@/lib/reservation-dates";
import { STATUS_COLORS, STATUS_LABELS } from "./reservation-badge";
import type { ReservationStatus } from "@/generated/prisma/client";

export type ReservationListItem = {
  id: string;
  startsAt: Date;
  durationMinutes: number;
  partySize: number;
  status: ReservationStatus;
  specialRequests: string | null;
  internalNote: string | null;
  tableId: string | null;
  table: { number: string } | null;
  customer: { name: string; email: string | null; phone: string | null };
};

export function DayView({
  reservations,
  totalCount,
  dateLabel,
  timeZone,
  onReservationClick,
}: {
  reservations: ReservationListItem[];
  totalCount: number;
  dateLabel: string;
  timeZone: string;
  onReservationClick: (id: string) => void;
}) {
  const formatTime = (d: Date) => formatZonedTime(d, timeZone);
  const sorted = [...reservations].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const groupMap = new Map<number, ReservationListItem[]>();
  for (const r of sorted) {
    const hourKey = toZonedTime(r.startsAt, timeZone).getHours();
    const group = groupMap.get(hourKey);
    if (group) group.push(r);
    else groupMap.set(hourKey, [r]);
  }
  const groups = [...groupMap.entries()].sort((a, b) => a[0] - b[0]);

  return (
    <section className="overflow-hidden rounded-[20px] border border-line-card bg-white shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-divider px-7 py-5">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-ink">{dateLabel}</h2>
          <p className="mt-0.5 text-[13.5px] text-ink-muted">Grouped by arrival hour</p>
        </div>
        <p className="text-[13.5px] font-semibold text-[#475569]">{totalCount} shown</p>
      </div>

      {groups.length === 0 && (
        <div className="p-10 text-center text-sm text-ink-muted">
          {totalCount === 0 ? "No reservations on this day." : "No reservations match your filters."}
        </div>
      )}

      {groups.map(([hour, items]) => (
        <div key={hour}>
          <div className="flex items-center gap-2.5 border-b border-line-divider bg-surface-footer px-7 py-2.5 text-xs font-bold tracking-wider text-ink-muted uppercase">
            <span>{formatTime(items[0]!.startsAt)}</span>
            <span className="min-w-5 rounded-full bg-[#E9ECF5] px-1.5 py-0.5 text-center text-[11.5px] font-bold text-[#475569]">
              {items.length}
            </span>
          </div>
          {items.map((r) => {
            const c = STATUS_COLORS[r.status];
            const cancelled = r.status === "CANCELLED";
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => onReservationClick(r.id)}
                aria-label={`${r.customer.name}, ${formatTime(r.startsAt)}, ${STATUS_LABELS[r.status]}`}
                className="flex w-full flex-wrap items-center gap-3 border-b border-line-divider px-7 py-3.5 text-left last:border-b-0 hover:bg-surface-footer"
              >
                <span className="min-h-9 w-1 shrink-0 self-stretch rounded" style={{ backgroundColor: c.bar }} />
                <span className="w-[86px] shrink-0 text-sm font-bold text-ink">{formatTime(r.startsAt)}</span>
                <span className="min-w-0 flex-1 basis-[180px]">
                  <span className={cn("block truncate text-[15px] font-bold text-ink", cancelled && "line-through opacity-75")}>
                    {r.customer.name}
                  </span>
                  <span className="block text-[13px] text-ink-muted">
                    {r.partySize} {r.partySize === 1 ? "guest" : "guests"}
                    {r.customer.phone ? ` · ${r.customer.phone}` : ""}
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-xs font-bold",
                    r.table ? "bg-neutral-soft text-neutral" : "bg-[#FEF3C7] text-[#92400E]"
                  )}
                >
                  {r.table ? `Table ${r.table.number}` : "Unassigned"}
                </span>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold" style={{ backgroundColor: c.bg, color: c.text }}>
                  <span className="size-1.5 rounded-full" style={{ backgroundColor: c.bar }} />
                  {STATUS_LABELS[r.status]}
                </span>
                <ChevronRight className="size-[18px] shrink-0 text-ink-placeholder" />
              </button>
            );
          })}
        </div>
      ))}
    </section>
  );
}
