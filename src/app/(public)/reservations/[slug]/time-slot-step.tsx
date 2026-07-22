"use client";

import { useEffect, useState } from "react";
import { Users, Calendar as CalendarIcon, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getWeekRange, toLocalDateInput } from "@/lib/reservation-dates";
import { getSlotsForDateAction } from "./actions";

export type TimeSlotSelection = { partySize: number; date: string; time: string | null };

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toLocalDateInput(d);
}

function addDaysToDate(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function TimeSlotStep({
  slug,
  value,
  onDateChange,
  onSlotSelect,
  onBack,
  onNext,
}: {
  slug: string;
  value: TimeSlotSelection;
  onDateChange: (date: string) => void;
  onSlotSelect: (time: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [slots, setSlots] = useState<string[]>([]);
  const [selectedDayOpen, setSelectedDayOpen] = useState(true);
  const [weekAvailability, setWeekAvailability] = useState<Record<string, "available" | "full" | "closed">>({});
  const [loading, setLoading] = useState(true);

  const { start: weekStart } = getWeekRange(new Date(`${value.date}T00:00:00`));
  const weekDates = Array.from({ length: 7 }, (_, i) => toLocalDateInput(addDaysToDate(weekStart, i)));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all(weekDates.map((d) => getSlotsForDateAction(slug, d, value.partySize))).then((results) => {
      if (cancelled) return;
      const availability: Record<string, "available" | "full" | "closed"> = {};
      weekDates.forEach((d, i) => {
        const result = results[i];
        if (!result?.isOpen) availability[d] = "closed";
        else availability[d] = result.slots.length > 0 ? "available" : "full";
      });
      setWeekAvailability(availability);
    });
    getSlotsForDateAction(slug, value.date, value.partySize).then((result) => {
      if (cancelled) return;
      setSlots(result.slots);
      setSelectedDayOpen(result.isOpen);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.date, value.partySize]);

  const amSlots = slots.filter((s) => Number(s.split(":")[0]) < 12);
  const pmSlots = slots.filter((s) => Number(s.split(":")[0]) >= 12);

  function formatSlotLabel(time: string): string {
    const [h, m] = time.split(":").map(Number);
    return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  function renderSlotGroup(label: string, groupSlots: string[]) {
    return (
      <div>
        <p className="mb-2 text-sm font-semibold">{label}</p>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : groupSlots.length === 0 ? (
          <p className="text-sm text-muted-foreground">No places available</p>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {groupSlots.map((s) => {
              const selected = value.time === s;
              return (
                <Button
                  key={s}
                  type="button"
                  variant={selected ? "default" : "outline"}
                  className={cn("h-auto px-5 py-3 text-sm", selected && "ring-2 ring-primary ring-offset-2")}
                  onClick={() => onSlotSelect(s)}
                >
                  {formatSlotLabel(s)}
                </Button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">Select your preferred time slot.</p>

      <div className="flex flex-wrap items-center gap-4 rounded-[5px] bg-muted px-4 py-2.5 text-sm font-medium">
        <span className="flex items-center gap-1.5">
          <Users className="size-4 text-muted-foreground" />
          {value.partySize} Guest{value.partySize === 1 ? "" : "s"}
        </span>
        <span className="flex items-center gap-1.5">
          <CalendarIcon className="size-4 text-muted-foreground" />
          {new Date(`${value.date}T00:00:00`).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}
        </span>
      </div>

      <p className="text-sm text-muted-foreground italic">Please select the party size, date and time.</p>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          className="h-9 shrink-0 px-2"
          onClick={() => onDateChange(addDays(value.date, -7))}
        >
          &lt;
        </Button>
        <div className="flex flex-1 justify-between gap-1 overflow-x-auto">
          {weekDates.map((d) => {
            const isSelected = d === value.date;
            const status = weekAvailability[d] ?? "available";
            const day = new Date(`${d}T00:00:00`);
            return (
              <button
                key={d}
                type="button"
                onClick={() => onDateChange(d)}
                className={cn(
                  "flex shrink-0 flex-col items-center gap-1 rounded-[5px] px-2 py-1.5 text-sm",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : status === "available"
                      ? "text-emerald-600 hover:bg-emerald-500/10"
                      : status === "closed"
                        ? "text-muted-foreground hover:bg-muted"
                        : "text-destructive hover:bg-destructive/10"
                )}
              >
                <span className="text-xs">{DAY_LABELS[day.getDay()]}</span>
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full font-semibold",
                    isSelected && "bg-white/20"
                  )}
                >
                  {day.getDate()}
                </span>
              </button>
            );
          })}
        </div>
        <Button
          type="button"
          variant="ghost"
          className="h-9 shrink-0 px-2"
          onClick={() => onDateChange(addDays(value.date, 7))}
        >
          &gt;
        </Button>
      </div>

      <div className="space-y-4">
        {!loading && !selectedDayOpen ? (
          <p className="text-sm text-muted-foreground">We&apos;re closed on this day. Please pick another date.</p>
        ) : (
          <>
            {renderSlotGroup("AM", amSlots)}
            {renderSlotGroup("PM", pmSlots)}
          </>
        )}
      </div>

      <div className="flex justify-between pt-2">
        <Button type="button" variant="outline" className="h-11 gap-2 px-5 text-base" onClick={onBack}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <Button type="button" className="h-11 gap-2 px-5 text-base" onClick={onNext} disabled={!value.time}>
          Next
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
