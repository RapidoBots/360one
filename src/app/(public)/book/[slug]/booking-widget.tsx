"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toLocalDateInput } from "@/lib/reservation-dates";
import { PartyDateTimePicker, type PartyDateTimeSelection } from "./party-date-time-picker";
import { ContactForm } from "./contact-form";
import { SuccessScreen } from "./success-screen";

export function formatDateLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });
}

export function formatTimeLabel(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

type Step = "PICK" | "REVIEW" | "CONTACT" | "SUCCESS";

export function BookingWidget({ slug, restaurantName }: { slug: string; restaurantName: string }) {
  const [step, setStep] = useState<Step>("PICK");
  const [selection, setSelection] = useState<PartyDateTimeSelection & { time: string | null }>({
    partySize: 2,
    date: toLocalDateInput(new Date()),
    time: null,
  });
  const [booking, setBooking] = useState<{ partySize: number; date: string; time: string } | null>(null);

  function handleSlotSelected(time: string) {
    setSelection((prev) => ({ ...prev, time }));
    setStep("REVIEW");
  }

  function resetToStart() {
    setBooking(null);
    setSelection({ partySize: 2, date: toLocalDateInput(new Date()), time: null });
    setStep("PICK");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col p-6">
      <h1 className="mb-6 text-xl font-semibold">Reserve a table at {restaurantName}</h1>

      <div className="flex-1">
        {step === "PICK" && (
          <PartyDateTimePicker
            slug={slug}
            value={selection}
            onChange={(v) => setSelection((prev) => ({ ...prev, ...v, time: null }))}
            onSlotSelected={handleSlotSelected}
          />
        )}

        {step === "REVIEW" && selection.time && (
          <div className="space-y-6">
            <p className="text-lg">
              Party of <strong>{selection.partySize}</strong> on <strong>{formatDateLabel(selection.date)}</strong> at{" "}
              <strong>{formatTimeLabel(selection.time)}</strong>.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="h-11 flex-1 text-base" onClick={() => setStep("PICK")}>
                Change
              </Button>
              <Button className="h-11 flex-1 text-base" onClick={() => setStep("CONTACT")}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === "CONTACT" && selection.time && (
          <ContactForm
            slug={slug}
            selection={{ partySize: selection.partySize, date: selection.date, time: selection.time }}
            onBack={() => setStep("REVIEW")}
            onSuccess={(b) => {
              setBooking(b);
              setStep("SUCCESS");
            }}
          />
        )}

        {step === "SUCCESS" && booking && <SuccessScreen booking={booking} onBookAnother={resetToStart} />}
      </div>

      <p className="pt-8 text-center text-xs text-muted-foreground">
        Powered by <span className="font-semibold">360One Inc.</span>
      </p>
    </div>
  );
}
