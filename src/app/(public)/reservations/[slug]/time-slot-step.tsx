"use client";

import { useEffect, useState } from "react";
import { Users, Calendar as CalendarIcon, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toLocalDateInput } from "@/lib/reservation-dates";
import type { SlotAvailability } from "@/lib/widget-availability";
import { getSlotsForDateAction } from "./actions";

export type TimeSlotSelection = { partySize: number; date: string; time: string | null };

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const PARTY_SIZES = Array.from({ length: 10 }, (_, i) => i + 1);

// Pure Y-M-D calendar arithmetic, anchored in UTC throughout so it never
// touches a real timezone (adding N days to a calendar date doesn't need one).
function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function mondayOfWeek(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const day = d.getUTCDay(); // 0 = Sunday ... 6 = Saturday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  return addDays(date, diffToMonday);
}

export function TimeSlotStep({
  slug,
  value,
  onPartySizeChange,
  onDateChange,
  onSlotSelect,
  onNext,
  timeZone,
}: {
  slug: string;
  value: TimeSlotSelection;
  onPartySizeChange: (partySize: number) => void;
  onDateChange: (date: string) => void;
  onSlotSelect: (time: string) => void;
  onNext: () => void;
  timeZone: string;
}) {
  const [slots, setSlots] = useState<SlotAvailability[]>([]);
  const [selectedDayOpen, setSelectedDayOpen] = useState(true);
  const [weekAvailability, setWeekAvailability] = useState<Record<string, "available" | "full" | "closed">>({});
  const [loading, setLoading] = useState(true);

  const weekStart = mondayOfWeek(value.date);
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const todayLocal = toLocalDateInput(new Date(), timeZone);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all(weekDates.map((d) => getSlotsForDateAction(slug, d, value.partySize))).then((results) => {
      if (cancelled) return;
      const availability: Record<string, "available" | "full" | "closed"> = {};
      weekDates.forEach((d, i) => {
        const result = results[i];
        if (!result?.isOpen) availability[d] = "closed";
        else availability[d] = result.slots.some((s) => s.available) ? "available" : "full";
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

  const amSlots = slots.filter((s) => Number(s.time.split(":")[0]) < 12);
  const pmSlots = slots.filter((s) => Number(s.time.split(":")[0]) >= 12);

  function formatSlotLabel(time: string): string {
    const [h, m] = time.split(":").map(Number);
    return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  function renderSlotGroup(label: string, groupSlots: SlotAvailability[]) {
    return (
      <div>
        <p className="mb-2 text-sm font-semibold">{label}</p>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : groupSlots.length === 0 ? (
          <p className="text-sm text-muted-foreground">No places available</p>
        ) : (
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 sm:gap-2">
            {groupSlots.map((s) => {
              const selected = value.time === s.time;
              return (
                <Button
                  key={s.time}
                  type="button"
                  disabled={!s.available}
                  className={cn(
                    "h-auto whitespace-nowrap px-1 py-2 text-xs sm:px-3 sm:py-2 sm:text-sm",
                    !s.available
                      ? "bg-muted text-muted-foreground line-through opacity-60 hover:bg-muted"
                      : selected
                        ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2"
                        : "bg-primary/90 text-primary-foreground hover:bg-primary"
                  )}
                  onClick={() => s.available && onSlotSelect(s.time)}
                >
                  {formatSlotLabel(s.time)}
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
      <div className="space-y-2">
        <Label htmlFor="widgetPartySize">Number of Guests</Label>
        <div className="relative">
          <Users className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
          <Select value={String(value.partySize)} onValueChange={(v) => v && onPartySizeChange(Number(v))}>
            <SelectTrigger id="widgetPartySize" className="h-11 w-full pl-9 text-base">
              <SelectValue>{(v: string) => `${v} Guest${v === "1" ? "" : "s"}`}</SelectValue>
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
      </div>

      <div className="space-y-2">
        <Label htmlFor="widgetDate">Date</Label>
        <div className="relative">
          <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="widgetDate"
            type="date"
            className="h-11 pl-9 text-base"
            min={todayLocal}
            value={value.date}
            onChange={(e) => e.target.value && onDateChange(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          className="h-9 shrink-0 px-2"
          onClick={() => onDateChange(addDays(value.date, -7))}
        >
          &lt;
        </Button>
        <div className="flex min-w-0 flex-1 justify-between gap-1 overflow-x-auto">
          {weekDates.map((d) => {
            const isSelected = d === value.date;
            const isPast = d < todayLocal;
            const status = weekAvailability[d] ?? "available";
            const day = new Date(`${d}T00:00:00`);
            return (
              <button
                key={d}
                type="button"
                disabled={isPast}
                onClick={() => onDateChange(d)}
                className={cn(
                  "flex shrink-0 flex-col items-center gap-0.5 rounded-[5px] border px-2.5 py-1.5 text-sm",
                  isPast
                    ? "cursor-not-allowed border-border text-muted-foreground opacity-40"
                    : isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : status === "available"
                        ? "border-emerald-600/40 text-emerald-600 hover:bg-emerald-500/10"
                        : status === "closed"
                          ? "border-border text-muted-foreground hover:bg-muted"
                          : "border-destructive/40 text-destructive hover:bg-destructive/10"
                )}
              >
                <span className="text-xs">{DAY_LABELS[day.getDay()]}</span>
                <span className="font-semibold">{day.getDate()}</span>
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

      <div className="flex justify-end pt-2">
        <Button type="button" className="h-11 gap-2 px-5 text-base" onClick={onNext} disabled={!value.time}>
          Next
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
