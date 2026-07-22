"use client";

import { cn } from "@/lib/utils";
import type { ReservationListItem } from "./day-view";

export function WeekView({
  reservations,
  weekStart,
  onDayClick,
  onReservationClick,
}: {
  reservations: ReservationListItem[];
  weekStart: Date;
  onDayClick: (date: Date) => void;
  onReservationClick: (id: string) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((day) => {
        const dayReservations = reservations
          .filter((r) => r.startsAt.toDateString() === day.toDateString())
          .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
        const isToday = day.toDateString() === new Date().toDateString();

        return (
          <div key={day.toISOString()} className="min-h-40 rounded-[5px] border border-border p-2">
            <button
              type="button"
              onClick={() => onDayClick(day)}
              className={cn(
                "mb-2 w-full rounded-lg px-2 py-1 text-left text-base font-medium hover:bg-muted",
                isToday && "bg-primary/10 text-primary"
              )}
            >
              {day.toLocaleDateString([], { weekday: "short", day: "numeric" })}
            </button>
            <div className="space-y-1">
              {dayReservations.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onReservationClick(r.id)}
                  className="block w-full truncate rounded-md bg-primary/10 px-2 py-1 text-left text-xs text-primary hover:bg-primary/20"
                >
                  {r.startsAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} {r.customer.name}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
