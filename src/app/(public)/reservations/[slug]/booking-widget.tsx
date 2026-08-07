"use client";

import { useState } from "react";
import Image from "next/image";
import { Phone } from "lucide-react";
import { toLocalDateInput, zonedDateTimeToUtc } from "@/lib/reservation-dates";
import { Brand } from "@/components/shell/brand";
import { Button } from "@/components/ui/button";

// lucide-react dropped brand/logo icons -- minimal inline glyphs instead of a new dependency.
function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M22 12a10 10 0 1 0-11.5 9.87v-6.98H7.98V12h2.52V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.23.2 2.23.2v2.45h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.98A10 10 0 0 0 22 12z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}
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

type Step = "TIME_SLOT" | "CONTACT" | "SUCCESS";

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
  const [step, setStep] = useState<Step>("TIME_SLOT");
  const [selection, setSelection] = useState<TimeSlotSelection>({
    partySize: 2,
    date: toLocalDateInput(new Date(), timeZone),
    time: null,
  });
  const [booking, setBooking] = useState<{ partySize: number; date: string; time: string } | null>(null);

  function resetToStart() {
    setBooking(null);
    setSelection({ partySize: 2, date: toLocalDateInput(new Date(), timeZone), time: null });
    setStep("TIME_SLOT");
  }

  const hasInfoPanel = Boolean(bannerUrl || phone || mapsEmbedUrl || notes);
  const showInfoPanel = (step === "TIME_SLOT" || step === "CONTACT") && hasInfoPanel;

  const mapsSearchUrl = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : null;

  const infoPanel = (
    <div className="min-w-0 space-y-4 rounded-lg border border-border bg-background p-4 shadow-sm sm:p-6 lg:h-fit">
      {bannerUrl && (
        // Shown here (portrait) only on desktop -- on mobile the banner
        // already renders full-width above everything else, landscape.
        <div className="relative hidden aspect-[3/4] w-full overflow-hidden rounded-[5px] lg:block">
          <Image src={bannerUrl} alt={`${restaurantName} banner`} fill className="object-cover" unoptimized />
        </div>
      )}
      {notes && <p className="text-sm text-muted-foreground">{notes}</p>}
      {phone && (
        <Button
          className="h-11 w-full gap-2 bg-blue-600 text-base text-white hover:bg-blue-700"
          render={<a href={`tel:${phone}`} />}
        >
          <Phone className="size-4" />
          Call Now
        </Button>
      )}
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
              className="flex items-center gap-1.5 text-primary underline-offset-4 hover:underline"
            >
              <FacebookIcon className="size-4" />
              Our Facebook page
            </a>
          )}
          {instagramUrl && (
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-primary underline-offset-4 hover:underline"
            >
              <InstagramIcon className="size-4" />
              Our Instagram profile
            </a>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div
      className={`mx-auto flex min-h-screen w-full flex-col overflow-x-hidden p-4 sm:p-6 ${showInfoPanel ? "max-w-5xl" : "max-w-3xl"}`}
    >
      {bannerUrl && showInfoPanel && (
        // Full-width landscape hero at the very top on mobile only -- on
        // desktop the banner instead renders portrait inside the sidebar.
        <div className="relative mb-4 aspect-video w-full overflow-hidden rounded-[5px] lg:hidden">
          <Image src={bannerUrl} alt={`${restaurantName} banner`} fill className="object-cover" unoptimized />
        </div>
      )}
      {logoUrl && (
        <Image
          src={logoUrl}
          alt={restaurantName}
          width={112}
          height={112}
          className="mx-auto mb-3 size-28 rounded-[5px] object-contain"
          unoptimized
        />
      )}

      <div className={showInfoPanel ? "grid min-w-0 gap-4 lg:grid-cols-[1fr_320px]" : undefined}>
        <div className="min-w-0 rounded-lg border border-border bg-background p-4 shadow-sm sm:p-6">
          {step === "TIME_SLOT" && (
            <TimeSlotStep
              slug={slug}
              value={selection}
              timeZone={timeZone}
              onPartySizeChange={(partySize) => setSelection((prev) => ({ ...prev, partySize, time: null }))}
              onDateChange={(date) => setSelection((prev) => ({ ...prev, date, time: null }))}
              onSlotSelect={(time) => setSelection((prev) => ({ ...prev, time }))}
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

          <p className="mt-8 flex items-center justify-center gap-1 text-center text-xs text-muted-foreground">
            powered by <Brand className="inline-block h-5 w-auto align-middle" />
          </p>
        </div>

        {showInfoPanel && infoPanel}
      </div>
    </div>
  );
}
