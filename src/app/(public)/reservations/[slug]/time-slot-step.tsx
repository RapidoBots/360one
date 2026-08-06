"use client";

import { useEffect, useState } from "react";
import { Users, Calendar as CalendarIcon, ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toLocalDateInput } from "@/lib/reservation-dates";
import type { SlotAvailability } from "@/lib/widget-availability";
import { getSlotsForDateAction } from "./actions";

export type TimeSlotSelection = { partySize: number; date: string; time: string | null };

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const PARTY_SIZES = Array.from({ length: 10 }, (_, i) => i + 1);

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function toDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function CalendarPicker({
  value,
  todayLocal,
  onSelect,
}: {
  value: string;
  todayLocal: string;
  onSelect: (date: string) => void;
}) {
  const [viewYear, setViewYear] = useState(Number(value.slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(Number(value.slice(5, 7)) - 1);

  function shiftMonth(delta: number) {
    const d = new Date(Date.UTC(viewYear, viewMonth + delta, 1));
    setViewYear(d.getUTCFullYear());
    setViewMonth(d.getUTCMonth());
  }

  const firstDow = new Date(Date.UTC(viewYear, viewMonth, 1)).getUTCDay();
  const total = daysInMonth(viewYear, viewMonth);
  const cells: (string | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: total }, (_, i) => toDateString(viewYear, viewMonth, i + 1)),
  ];

  return (
    <div className="w-72 p-3">
      <div className="mb-2 flex items-center justify-between">
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => shiftMonth(-1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-semibold">
          {new Date(Date.UTC(viewYear, viewMonth, 1)).toLocaleDateString([], {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          })}
        </span>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Next month" onClick={() => shiftMonth(1)}>
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 pb-1 text-center text-xs text-muted-foreground">
        {DAY_LABELS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <div key={i} />;
          const isPast = date < todayLocal;
          const isSelected = date === value;
          return (
            <button
              key={date}
              type="button"
              disabled={isPast}
              onClick={() => onSelect(date)}
              className={cn(
                "flex size-9 items-center justify-center rounded-md text-sm transition-colors",
                isPast
                  ? "cursor-not-allowed text-muted-foreground opacity-40"
                  : isSelected
                    ? "bg-primary font-semibold text-primary-foreground"
                    : "hover:bg-muted"
              )}
            >
              {Number(date.slice(8, 10))}
            </button>
          );
        })}
      </div>
    </div>
  );
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
  const [loading, setLoading] = useState(true);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const todayLocal = toLocalDateInput(new Date(), timeZone);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getSlotsForDateAction(slug, value.date, value.partySize).then((result) => {
      if (cancelled) return;
      setSlots(result.slots);
      setSelectedDayOpen(result.isOpen);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [slug, value.date, value.partySize]);

  const amSlots = slots.filter((s) => Number(s.time.split(":")[0]) < 12);
  const pmSlots = slots.filter((s) => Number(s.time.split(":")[0]) >= 12);

  function formatSlotLabel(time: string): string {
    const [h, m] = time.split(":").map(Number);
    return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  function formatDateLabel(date: string): string {
    return new Date(`${date}T00:00:00`).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });
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
        <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
          <PopoverTrigger
            id="widgetDate"
            render={
              <button
                type="button"
                className="relative h-11 w-full rounded-lg border border-input bg-transparent pl-9 text-left text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            }
          >
            <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            {formatDateLabel(value.date)}
          </PopoverTrigger>
          <PopoverContent>
            <CalendarPicker
              value={value.date}
              todayLocal={todayLocal}
              onSelect={(date) => {
                onDateChange(date);
                setDatePickerOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
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
