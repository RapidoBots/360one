"use client";

import { useEffect, useState } from "react";
import { toZonedTime } from "date-fns-tz";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { quickSeatWalkInAction } from "./actions";
import { findCustomerByPhoneAction } from "../reservations/actions";

// The server interprets this value as a wall-clock time in the restaurant's
// own timezone (see zonedDateTimeToUtc in quickSeatWalkInAction) -- reading
// the browser's own local clock here would drift by the offset between the
// visitor's timezone and the restaurant's whenever they differ.
function currentTimeInput(timeZone: string) {
  const now = toZonedTime(new Date(), timeZone);
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export function QuickSeatDialog({
  open,
  onOpenChange,
  slug,
  tableId,
  tableNumber,
  timeZone,
  onSeated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  tableId: string | null;
  tableNumber: string;
  timeZone: string;
  onSeated: () => void;
}) {
  // Phone-first: ask for the guest's phone before anything else, so a
  // returning guest's name auto-fills. "Skip" preserves the original
  // behavior of seating a fully anonymous "Walk-in" with no name/phone.
  const [phoneStep, setPhoneStep] = useState(true);
  const [lookupPhone, setLookupPhone] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [time, setTime] = useState(() => currentTimeInput(timeZone));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPhoneStep(true);
    setLookupPhone("");
    setGuestName("");
    setGuestPhone("");
    setPartySize(2);
    setTime(currentTimeInput(timeZone));
    setError(null);
  }, [open, timeZone]);

  async function handlePhoneContinue(e: React.FormEvent) {
    e.preventDefault();
    setLookingUp(true);
    setError(null);
    const match = await findCustomerByPhoneAction(slug, lookupPhone);
    setLookingUp(false);
    setGuestPhone(lookupPhone);
    setGuestName(match?.name ?? "");
    setPhoneStep(false);
  }

  function handleSkip() {
    setGuestName("Walk-in");
    setGuestPhone("");
    setPhoneStep(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tableId) return;
    setSaving(true);
    setError(null);
    const result = await quickSeatWalkInAction(slug, tableId, {
      partySize,
      time,
      guestName: guestName || "Walk-in",
      guestPhone,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onOpenChange(false);
    onSeated();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add walk-in at Table {tableNumber}</DialogTitle>
        </DialogHeader>

        {phoneStep ? (
          <form onSubmit={handlePhoneContinue} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="walkInLookupPhone">Phone number</Label>
              <Input
                id="walkInLookupPhone"
                type="tel"
                className="h-11 text-base"
                placeholder="(555) 123-4567"
                value={lookupPhone}
                onChange={(e) => setLookupPhone(e.target.value)}
                autoFocus
              />
              <p className="text-sm text-muted-foreground">
                A returning guest&apos;s name fills in automatically.
              </p>
            </div>
            <div className="flex gap-3">
              <Button type="submit" className="h-11 flex-1 text-base" disabled={lookingUp}>
                {lookingUp ? "Looking up..." : "Continue"}
              </Button>
              <Button type="button" variant="outline" className="h-11 text-base" onClick={handleSkip}>
                Skip
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="walkInName">Name</Label>
              <button
                type="button"
                className="text-sm text-primary underline-offset-4 hover:underline"
                onClick={() => setPhoneStep(true)}
              >
                Use a different phone number
              </button>
            </div>
            <Input
              id="walkInName"
              className="h-11 text-base"
              placeholder="Guest name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="walkInPartySize">Party size</Label>
                <Input
                  id="walkInPartySize"
                  type="number"
                  min={1}
                  className="h-11 text-base"
                  placeholder="Number of guests"
                  value={partySize}
                  onChange={(e) => setPartySize(Number(e.target.value))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="walkInTime">Time</Label>
                <Input
                  id="walkInTime"
                  type="time"
                  className="h-11 text-base"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Leave the time as-is to seat right now, or pick a later time today to book this table for that slot.
            </p>
            {error && <p className="text-base text-destructive">{error}</p>}
            <Button type="submit" className="h-12 w-full text-base" disabled={saving}>
              {saving ? "Adding..." : "Add walk-in"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
