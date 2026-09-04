"use client";

import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateLabel, formatTimeLabel } from "./booking-widget";

export function SuccessScreen({
  booking,
  timeZone,
  restaurantName,
  successMessage,
  successButtonText,
  onBookAnother,
}: {
  booking: { partySize: number; date: string; time: string };
  timeZone: string;
  restaurantName: string;
  successMessage: string | null;
  successButtonText: string | null;
  onBookAnother: () => void;
}) {
  const message = successMessage
    ? successMessage.replaceAll("{restaurant_name}", restaurantName)
    : `We've received your request for ${booking.partySize} ${
        booking.partySize === 1 ? "guest" : "guests"
      } on ${formatDateLabel(booking.date, timeZone)} at ${formatTimeLabel(booking.time)} -- we'll be in touch to confirm.`;

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", duration: 0.5 }}
      >
        <CheckCircle2 className="size-16 text-emerald-500" />
      </motion.div>
      <h2 className="text-lg font-semibold">Request received!</h2>
      <p className="max-w-sm text-base whitespace-pre-wrap text-muted-foreground">{message}</p>
      <Button variant="outline" className="h-11 px-5 text-base" onClick={onBookAnother}>
        {successButtonText || "Book another reservation"}
      </Button>
    </div>
  );
}
