"use client";

import { useEffect, useState } from "react";
import { toZonedTime } from "date-fns-tz";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { quickSeatWalkInAction } from "./actions";

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
  const [partySize, setPartySize] = useState(2);
  const [time, setTime] = useState(() => currentTimeInput(timeZone));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPartySize(2);
    setTime(currentTimeInput(timeZone));
    setError(null);
  }, [open, timeZone]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tableId) return;
    setSaving(true);
    setError(null);
    const result = await quickSeatWalkInAction(slug, tableId, { partySize, time });
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
        <form onSubmit={handleSubmit} className="space-y-4">
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
      </DialogContent>
    </Dialog>
  );
}
