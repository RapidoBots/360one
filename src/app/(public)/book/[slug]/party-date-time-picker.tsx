"use client";

import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getWeekRange, toLocalDateInput } from "@/lib/reservation-dates";
import { getSlotsForDateAction } from "./actions";

export type PartyDateTimeSelection = { partySize: number; date: string };

const PARTY_SIZES = Array.from({ length: 10 }, (_, i) => i + 1);
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

export function PartyDateTimePicker({
  slug,
  value,
  onChange,
  onSlotSelected,
}: {
  slug: string;
  value: PartyDateTimeSelection;
  onChange: (value: PartyDateTimeSelection) => void;
  onSlotSelected: (time: string) => void;
}) {
  const [slots, setSlots] = useState<string[]>([]);
  const [weekAvailability, setWeekAvailability] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const { start: weekStart } = getWeekRange(new Date(`${value.date}T00:00:00`));
  const weekDates = Array.from({ length: 7 }, (_, i) => toLocalDateInput(addDaysToDate(weekStart, i)));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all(weekDates.map((d) => getSlotsForDateAction(slug, d, value.partySize))).then((results) => {
      if (cancelled) return;
      const availability: Record<string, boolean> = {};
      weekDates.forEach((d, i) => {
        availability[d] = (results[i]?.length ?? 0) > 0;
      });
      setWeekAvailability(availability);
    });
    getSlotsForDateAction(slug, value.date, value.partySize).then((result) => {
      if (cancelled) return;
      setSlots(result);
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

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Party</label>
          <Select value={String(value.partySize)} onValueChange={(v) => onChange({ ...value, partySize: Number(v) })}>
            <SelectTrigger className="h-11 w-full text-base">
              <SelectValue>{(v: string) => v}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PARTY_SIZES.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Date</label>
          <Input
            type="date"
            className="h-11 text-base"
            value={value.date}
            onChange={(e) => onChange({ ...value, date: e.target.value })}
          />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        If you are more than 10 people or if you cannot find availability, please call us.
      </p>

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          className="h-9 px-2"
          onClick={() => onChange({ ...value, date: addDays(value.date, -7) })}
        >
          &lt;
        </Button>
        <div className="flex flex-1 justify-between gap-1">
          {weekDates.map((d) => {
            const isSelected = d === value.date;
            const available = weekAvailability[d] ?? true;
            const day = new Date(`${d}T00:00:00`);
            return (
              <button
                key={d}
                type="button"
                onClick={() => onChange({ ...value, date: d })}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-[5px] px-2 py-1.5 text-sm",
                  isSelected
                    ? "bg-emerald-500 text-white"
                    : available
                      ? "text-emerald-600 hover:bg-emerald-500/10"
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
          className="h-9 px-2"
          onClick={() => onChange({ ...value, date: addDays(value.date, 7) })}
        >
          &gt;
        </Button>
      </div>

      <div className="space-y-4">
        <div>
          <p className="mb-2 text-sm font-semibold">AM</p>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : amSlots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No places available</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {amSlots.map((s) => (
                <Button
                  key={s}
                  type="button"
                  className="h-11 bg-emerald-500 text-sm text-white hover:bg-emerald-600"
                  onClick={() => onSlotSelected(s)}
                >
                  {formatSlotLabel(s)}
                </Button>
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold">PM</p>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : pmSlots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No places available</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {pmSlots.map((s) => (
                <Button
                  key={s}
                  type="button"
                  className="h-11 bg-emerald-500 text-sm text-white hover:bg-emerald-600"
                  onClick={() => onSlotSelected(s)}
                >
                  {formatSlotLabel(s)}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
