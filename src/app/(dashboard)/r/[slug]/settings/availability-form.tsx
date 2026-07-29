"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toLocalDateInput } from "@/lib/reservation-dates";
import {
  getAvailabilityForDateAction,
  setDateClosedAction,
  toggleBlockedSlotAction,
  type DateAvailability,
} from "./availability-actions";

function formatSlotLabel(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function AvailabilityForm({ slug, timezone }: { slug: string; timezone: string }) {
  const [date, setDate] = useState(() => toLocalDateInput(new Date(), timezone));
  const [availability, setAvailability] = useState<DateAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [togglingTime, setTogglingTime] = useState<string | null>(null);
  const [togglingClosed, setTogglingClosed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAvailabilityForDateAction(slug, date).then((result) => {
      if (!cancelled) {
        setAvailability(result);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [slug, date]);

  async function handleToggleClosed() {
    if (!availability) return;
    setTogglingClosed(true);
    const result = await setDateClosedAction(slug, date, !availability.closed);
    setAvailability(result);
    setTogglingClosed(false);
  }

  async function handleToggleSlot(time: string) {
    setTogglingTime(time);
    const result = await toggleBlockedSlotAction(slug, date, time);
    setAvailability(result);
    setTogglingTime(null);
  }

  return (
    <div className="space-y-4 rounded-[5px] border border-border p-5">
      <h2 className="text-base font-semibold">Availability overrides</h2>
      <p className="text-sm text-muted-foreground">
        Block off specific times or an entire day -- for holidays, private events, or anything outside your regular
        weekly hours. Blocked slots show up greyed out and unselectable on the reservation widget.
      </p>

      <div className="max-w-xs space-y-2">
        <Label htmlFor="availabilityDate">Date</Label>
        <Input
          id="availabilityDate"
          type="date"
          className="h-11 text-base"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      {loading || !availability ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <>
          <Button
            type="button"
            variant={availability.closed ? "default" : "outline"}
            className={cn("h-11 px-5 text-base", availability.closed && "bg-destructive hover:bg-destructive/90")}
            disabled={togglingClosed}
            onClick={handleToggleClosed}
          >
            {availability.closed ? "Closed all day -- click to reopen" : "Close entire day"}
          </Button>

          {availability.closed ? (
            <p className="text-sm text-muted-foreground">
              This date is fully closed to reservations. Reopen it to manage individual slots.
            </p>
          ) : availability.slotTimes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              This date falls outside your business hours, so there are no slots to block.
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 sm:gap-3">
              {availability.slotTimes.map((time) => {
                const blocked = availability.blockedTimes.includes(time);
                return (
                  <Button
                    key={time}
                    type="button"
                    disabled={togglingTime === time}
                    className={cn(
                      "h-auto whitespace-normal px-2 py-2.5 text-xs sm:px-5 sm:py-3 sm:text-sm",
                      blocked
                        ? "bg-destructive/10 text-destructive line-through hover:bg-destructive/20"
                        : "bg-primary/90 text-primary-foreground hover:bg-primary"
                    )}
                    onClick={() => handleToggleSlot(time)}
                  >
                    {formatSlotLabel(time)}
                  </Button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
