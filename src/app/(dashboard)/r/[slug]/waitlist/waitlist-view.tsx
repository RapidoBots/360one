"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AddWaitlistDialog } from "./add-waitlist-dialog";
import { SeatDialog, type SeatableTable } from "./seat-dialog";
import { updateWaitlistStatusAction } from "./actions";
import { listAvailableTables } from "@/lib/table-allocation";
import type { WaitlistStatus } from "@/generated/prisma/client";

export type WaitlistEntryItem = {
  id: string;
  partySize: number;
  quotedWaitMinutes: number | null;
  status: WaitlistStatus;
  notes: string | null;
  joinedAt: Date;
  customer: { name: string; phone: string | null };
};

type ReservationForAvailability = { tableId: string | null; startsAt: Date; durationMinutes: number };

function formatElapsed(joinedAt: Date, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - joinedAt.getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

const HISTORY_LABELS: Partial<Record<WaitlistStatus, string>> = {
  SEATED: "Seated",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
};

export function WaitlistView({
  slug,
  waiting,
  todayHistory,
  tables,
  reservations,
}: {
  slug: string;
  waiting: WaitlistEntryItem[];
  todayHistory: WaitlistEntryItem[];
  tables: SeatableTable[];
  reservations: ReservationForAvailability[];
}) {
  const router = useRouter();
  const [now, setNow] = useState(() => new Date());
  const [addOpen, setAddOpen] = useState(false);
  const [seating, setSeating] = useState<{ id: string; name: string; partySize: number } | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  async function handleStatusChange(id: string, status: "CANCELLED" | "NO_SHOW") {
    await updateWaitlistStatusAction(slug, id, status);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Waitlist</h1>
        <Button className="h-11 px-5 text-base" onClick={() => setAddOpen(true)}>
          Add to waitlist
        </Button>
      </div>

      {waiting.length === 0 ? (
        <p className="py-16 text-center text-base text-muted-foreground">No one is waiting right now.</p>
      ) : (
        <ul className="divide-y divide-border rounded-[5px] border border-border">
          {waiting.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="font-medium">{entry.customer.name}</p>
                <p className="text-base text-muted-foreground">
                  Party of {entry.partySize}
                  {entry.customer.phone ? ` · ${entry.customer.phone}` : ""}
                  {" · waiting "}
                  {formatElapsed(entry.joinedAt, now)}
                  {entry.quotedWaitMinutes != null ? ` (quoted ~${entry.quotedWaitMinutes}m)` : ""}
                </p>
                {entry.notes && <p className="text-sm text-muted-foreground">{entry.notes}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  className="h-9"
                  onClick={() => setSeating({ id: entry.id, name: entry.customer.name, partySize: entry.partySize })}
                >
                  Seat
                </Button>
                <Button variant="outline" className="h-9" onClick={() => handleStatusChange(entry.id, "NO_SHOW")}>
                  No-show
                </Button>
                <Button variant="outline" className="h-9" onClick={() => handleStatusChange(entry.id, "CANCELLED")}>
                  Cancel
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {todayHistory.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-base font-semibold">Today</h2>
          <ul className="divide-y divide-border rounded-[5px] border border-border">
            {todayHistory.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="font-medium">{entry.customer.name}</p>
                  <p className="text-base text-muted-foreground">Party of {entry.partySize}</p>
                </div>
                <Badge variant="outline">{HISTORY_LABELS[entry.status]}</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}

      <AddWaitlistDialog open={addOpen} onOpenChange={setAddOpen} slug={slug} onAdded={() => router.refresh()} />
      <SeatDialog
        open={seating !== null}
        onOpenChange={(open) => !open && setSeating(null)}
        slug={slug}
        waitlistEntryId={seating?.id ?? null}
        guestName={seating?.name ?? ""}
        availableTables={
          seating ? listAvailableTables(tables, reservations, { partySize: seating.partySize, now }) : []
        }
        onSeated={() => router.refresh()}
      />
    </div>
  );
}
