"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { quickSeatWalkInAction } from "./actions";

function currentTimeInput() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export function QuickSeatDialog({
  open,
  onOpenChange,
  slug,
  tableId,
  tableNumber,
  onSeated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  tableId: string | null;
  tableNumber: string;
  onSeated: () => void;
}) {
  const [partySize, setPartySize] = useState(2);
  const [time, setTime] = useState(currentTimeInput);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPartySize(2);
    setTime(currentTimeInput());
    setError(null);
  }, [open]);

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
