"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { setReservationStatusAction } from "../reservations/actions";
import type { TableStatusReservation } from "@/lib/table-status";

export function SeatedInfoDialog({
  open,
  onOpenChange,
  slug,
  tableNumber,
  reservation,
  onFreed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  tableNumber: string;
  reservation: TableStatusReservation | null;
  onFreed: () => void;
}) {
  const [freeing, setFreeing] = useState(false);

  async function handleFree() {
    if (!reservation) return;
    setFreeing(true);
    await setReservationStatusAction(slug, reservation.id, "COMPLETED");
    setFreeing(false);
    onOpenChange(false);
    onFreed();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Table {tableNumber}</DialogTitle>
        </DialogHeader>
        {reservation && (
          <div className="space-y-4">
            <div className="space-y-1 text-base">
              <p className="font-semibold">{reservation.customerName}</p>
              <p className="text-muted-foreground">Party of {reservation.partySize}</p>
              <p className="text-muted-foreground">
                Seated at {reservation.startsAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </p>
            </div>
            <Button className="h-11 w-full text-base" onClick={handleFree} disabled={freeing}>
              {freeing ? "Freeing..." : "Free table"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
