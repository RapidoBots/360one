"use client";

import { useState } from "react";
import Image from "next/image";
import { Phone } from "lucide-react";
import { toLocalDateInput, zonedDateTimeToUtc } from "@/lib/reservation-dates";
import { Brand } from "@/components/shell/brand";
import { Button } from "@/components/ui/button";
import { StepProgress } from "./step-progress";
import { GuestDateStep } from "./guest-date-step";
import { TimeSlotStep, type TimeSlotSelection } from "./time-slot-step";
import { ContactForm } from "./contact-form";
import { SuccessScreen } from "./success-screen";

export function formatDateLabel(date: string, timeZone: string): string {
  // Anchored at noon so it's unambiguously within the intended calendar day
  // once viewed in timeZone -- midnight UTC could fall on the previous day.
  return zonedDateTimeToUtc(date, "12:00", timeZone).toLocaleDateString([], {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone,
  });
}

export function formatTimeLabel(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

type Step = "GUEST_DATE" | "TIME_SLOT" | "CONTACT" | "SUCCESS";

const STEP_NUMBER: Record<Step, number> = { GUEST_DATE: 1, TIME_SLOT: 2, CONTACT: 3, SUCCESS: 3 };

export function BookingWidget({
  slug,
  restaurantName,
  timeZone,
  logoUrl,
  bannerUrl,
  mapsEmbedUrl,
  address,
  phone,
  notes,
  facebookUrl,
  instagramUrl,
}: {
  slug: string;
  restaurantName: string;
  timeZone: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  mapsEmbedUrl: string | null;
  address: string | null;
  phone: string | null;
  notes: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
}) {
  const [step, setStep] = useState<Step>("GUEST_DATE");
  const [selection, setSelection] = useState<TimeSlotSelection>({
    partySize: 2,
    date: toLocalDateInput(new Date(), timeZone),
    time: null,
  });
  const [booking, setBooking] = useState<{ partySize: number; date: string; time: string } | null>(null);

  function resetToStart() {
    setBooking(null);
    setSelection({ partySize: 2, date: toLocalDateInput(new Date(), timeZone), time: null });
    setStep("GUEST_DATE");
  }

  const hasInfoPanel = Boolean(bannerUrl || phone || mapsEmbedUrl || notes);
  const showInfoPanel = step === "TIME_SLOT" && hasInfoPanel;

  const mapsSearchUrl = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : null;

  const infoPanel = (
    <div className="space-y-4 rounded-lg border border-border bg-background p-4 shadow-sm sm:p-6 lg:h-fit">
      {bannerUrl && (
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[5px]">
          <Image src={bannerUrl} alt={`${restaurantName} banner`} fill className="object-cover" unoptimized />
        </div>
      )}
      {phone && (
        <Button
          className="h-11 w-full gap-2 bg-blue-600 text-base text-white hover:bg-blue-700"
          render={<a href={`tel:${phone}`} />}
        >
          <Phone className="size-4" />
          Call Now
        </Button>
      )}
      {notes && <p className="text-sm text-muted-foreground">{notes}</p>}
      {mapsEmbedUrl && (
        <iframe
          src={mapsEmbedUrl}
          className="h-64 w-full rounded-[5px] border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title={`${restaurantName} location`}
        />
      )}
      {address && mapsSearchUrl && (
        <a
          href={mapsSearchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-sm text-primary underline-offset-4 hover:underline"
        >
          {address}
        </a>
      )}
      {(facebookUrl || instagramUrl) && (
        <div className="flex flex-col gap-1.5 text-sm">
          {facebookUrl && (
            <a
              href={facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline-offset-4 hover:underline"
            >
              Our Facebook page
            </a>
          )}
          {instagramUrl && (
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline-offset-4 hover:underline"
            >
              Our Instagram profile
            </a>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className={`mx-auto flex min-h-screen flex-col p-4 sm:p-6 ${showInfoPanel ? "max-w-5xl" : "max-w-3xl"}`}>
      {logoUrl && (
        <Image
          src={logoUrl}
          alt={restaurantName}
          width={64}
          height={64}
          className="mx-auto mb-3 size-16 rounded-[5px] object-cover"
          unoptimized
        />
      )}
      <h1 className="mb-4 text-center text-lg font-semibold sm:mb-6">Reserve a table at {restaurantName}</h1>

      {step !== "SUCCESS" && <StepProgress current={STEP_NUMBER[step]} />}

      <div className={showInfoPanel ? "grid gap-4 lg:grid-cols-[1fr_320px]" : undefined}>
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
              timeZone={timeZone}
              onDateChange={(date) => setSelection((prev) => ({ ...prev, date, time: null }))}
              onSlotSelect={(time) => setSelection((prev) => ({ ...prev, time }))}
              onBack={() => setStep("GUEST_DATE")}
              onNext={() => setStep("CONTACT")}
            />
          )}

          {step === "CONTACT" && selection.time && (
            <ContactForm
              slug={slug}
              selection={{ partySize: selection.partySize, date: selection.date, time: selection.time }}
              onBack={() => setStep("TIME_SLOT")}
              onSuccess={(b) => {
                setBooking(b);
                setStep("SUCCESS");
              }}
            />
          )}

          {step === "SUCCESS" && booking && (
            <SuccessScreen booking={booking} timeZone={timeZone} onBookAnother={resetToStart} />
          )}

          <p className="mt-8 text-center text-xs text-muted-foreground">
            powered by <Brand className="font-semibold" />
          </p>
        </div>

        {showInfoPanel && infoPanel}
      </div>
    </div>
  );
}
