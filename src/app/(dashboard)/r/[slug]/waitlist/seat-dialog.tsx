"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { seatFromWaitlistAction } from "./actions";

export type SeatableTable = { id: string; number: string; capacity: number };

export function SeatDialog({
  open,
  onOpenChange,
  slug,
  waitlistEntryId,
  guestName,
  availableTables,
  onSeated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  waitlistEntryId: string | null;
  guestName: string;
  availableTables: SeatableTable[];
  onSeated: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [savingTableId, setSavingTableId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSavingTableId(null);
  }, [open]);

  async function handlePick(tableId: string) {
    if (!waitlistEntryId) return;
    setSavingTableId(tableId);
    setError(null);
    const result = await seatFromWaitlistAction(slug, waitlistEntryId, tableId);
    setSavingTableId(null);
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
          <DialogTitle>Seat {guestName}</DialogTitle>
        </DialogHeader>
        {availableTables.length === 0 ? (
          <p className="text-base text-muted-foreground">No tables free right now.</p>
        ) : (
          <div className="space-y-2">
            {availableTables.map((t) => (
              <Button
                key={t.id}
                type="button"
                variant="outline"
                className="h-11 w-full justify-between text-base"
                disabled={savingTableId !== null}
                onClick={() => handlePick(t.id)}
              >
                <span>Table {t.number}</span>
                <span className="text-muted-foreground">seats {t.capacity}</span>
              </Button>
            ))}
          </div>
        )}
        {error && <p className="text-base text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
