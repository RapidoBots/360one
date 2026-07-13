"use client";

import { useState } from "react";
import { toLocalDateInput } from "@/lib/reservation-dates";
import { Brand } from "@/components/shell/brand";
import { StepProgress } from "./step-progress";
import { GuestDateStep } from "./guest-date-step";
import { TimeSlotStep, type TimeSlotSelection } from "./time-slot-step";
import { ContactForm } from "./contact-form";
import { SuccessScreen } from "./success-screen";

export function formatDateLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });
}

export function formatTimeLabel(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

type Step = "GUEST_DATE" | "TIME_SLOT" | "CONTACT" | "SUCCESS";

const STEP_NUMBER: Record<Step, number> = { GUEST_DATE: 1, TIME_SLOT: 2, CONTACT: 3, SUCCESS: 3 };

export function BookingWidget({ slug, restaurantName }: { slug: string; restaurantName: string }) {
  const [step, setStep] = useState<Step>("GUEST_DATE");
  const [selection, setSelection] = useState<TimeSlotSelection>({
    partySize: 2,
    date: toLocalDateInput(new Date()),
    time: null,
  });
  const [booking, setBooking] = useState<{ partySize: number; date: string; time: string } | null>(null);

  function resetToStart() {
    setBooking(null);
    setSelection({ partySize: 2, date: toLocalDateInput(new Date()), time: null });
    setStep("GUEST_DATE");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col p-4 sm:p-6">
      <h1 className="mb-4 text-center text-lg font-semibold sm:mb-6">Reserve a table at {restaurantName}</h1>

      {step !== "SUCCESS" && <StepProgress current={STEP_NUMBER[step]} />}

      <div className="rounded-lg border border-border bg-background p-4 shadow-sm sm:p-6">
        {step === "GUEST_DATE" && (
          <GuestDateStep
            value={{ partySize: selection.partySize, date: selection.date }}
            onChange={(v) => setSelection((prev) => ({ ...prev, ...v, time: null }))}
            onNext={() => setStep("TIME_SLOT")}
          />
        )}

        {step === "TIME_SLOT" && (
          <TimeSlotStep
            slug={slug}
            value={selection}
            onDateChange={(date) => setSelection((prev) => ({ ...prev, date, time: null }))}
            onSlotSelect={(time) => setSelection((prev) => ({ ...prev, time }))}
            onNext={() => setStep("CONTACT")}
          />
        )}

        {step === "CONTACT" && selection.time && (
          <ContactForm
            slug={slug}
            selection={{ partySize: selection.partySize, date: selection.date, time: selection.time }}
            onSuccess={(b) => {
              setBooking(b);
              setStep("SUCCESS");
            }}
          />
        )}

        {step === "SUCCESS" && booking && <SuccessScreen booking={booking} onBookAnother={resetToStart} />}

        <p className="mt-8 text-center text-xs text-muted-foreground">
          powered by <Brand className="font-semibold" />
        </p>
      </div>
    </div>
  );
}
