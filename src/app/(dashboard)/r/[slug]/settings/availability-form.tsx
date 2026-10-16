"use client";

import { useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SectionCard, SectionCardBody, FieldLabel } from "@/components/ui/section-card";
import { toLocalDateInput } from "@/lib/reservation-dates";
import {
  getAvailabilityForDateAction,
  setDateClosedAction,
  toggleBlockedSlotAction,
  type DateAvailability,
} from "./availability-actions";

const fieldClass =
  "h-11 w-full rounded-xl border-line-input bg-white px-3.5 text-sm font-medium text-ink focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/16";

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

  let dateLabel = "this day";
  try {
    dateLabel = new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  } catch {
    // keep fallback
  }

  const total = availability?.slotTimes.length ?? 0;
  const blockedCount = availability?.blockedTimes.length ?? 0;
  const openCount = total - blockedCount;

  return (
    <SectionCard
      id="overrides"
      icon={CalendarClock}
      title="Availability overrides"
      description="Block specific times or a whole day for holidays, private events or anything outside your regular hours. Blocked slots appear greyed out and can't be selected in the widget."
    >
      <SectionCardBody>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <label className="flex max-w-[260px] flex-1 flex-col gap-2">
            <FieldLabel>Date</FieldLabel>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={fieldClass} />
          </label>
          {availability && !loading && (
            <button
              type="button"
              onClick={handleToggleClosed}
              disabled={togglingClosed}
              className="flex h-11 items-center gap-2 rounded-xl border border-[#D5DAEA] bg-white px-4.5 text-sm font-semibold text-ink hover:bg-[#F8F9FD] disabled:opacity-60"
            >
              {availability.closed ? "Reopen entire day" : "Close entire day"}
            </button>
          )}
        </div>

        {loading || !availability ? (
          <p className="text-sm text-ink-muted">Loading...</p>
        ) : availability.closed ? (
          <p className="text-sm text-ink-muted">
            This date is fully closed to reservations. Reopen it to manage individual slots.
          </p>
        ) : total === 0 ? (
          <p className="text-sm text-ink-muted">
            This date falls outside your business hours, so there are no slots to block.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-semibold text-ink">
                {openCount} of {total} time slots open on {dateLabel}
              </div>
              <div className="flex items-center gap-4 text-[12.5px] text-ink-muted">
                <span className="flex items-center gap-1.5">
                  <span className="size-3 rounded-[4px] border border-primary bg-primary/10" />
                  Open
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-3 rounded-[4px] border border-[#CBD5E1] bg-neutral-soft" />
                  Blocked
                </span>
              </div>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2.5">
              {availability.slotTimes.map((time) => {
                const blocked = availability.blockedTimes.includes(time);
                return (
                  <button
                    key={time}
                    type="button"
                    aria-pressed={blocked}
                    aria-label={`${formatSlotLabel(time)}, ${blocked ? "blocked" : "open"}`}
                    disabled={togglingTime === time}
                    onClick={() => handleToggleSlot(time)}
                    className={`h-[42px] rounded-[10px] border text-[13px] font-semibold transition-colors disabled:opacity-60 ${
                      blocked
                        ? "border-[#CBD5E1] bg-neutral-soft text-ink-muted line-through"
                        : "border-transparent bg-primary/10 text-primary hover:border-primary"
                    }`}
                  >
                    {formatSlotLabel(time)}
                  </button>
                );
              })}
            </div>
            <p className="text-[12.5px] text-ink-muted">Select a time to block or unblock it for this date.</p>
          </>
        )}
      </SectionCardBody>
    </SectionCard>
  );
}
