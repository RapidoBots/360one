"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import { STATUS_COLORS, STATUS_LABELS } from "../reservations/reservation-badge";
import { setReservationStatusAction } from "../reservations/actions";
import type { ReservationStatus } from "@/generated/prisma/client";

export type UpcomingArrival = {
  id: string;
  time: string;
  name: string;
  party: number;
  table: string | null;
  status: ReservationStatus;
};

export function UpcomingArrivals({
  slug,
  arrivals,
  canSeat,
}: {
  slug: string;
  arrivals: UpcomingArrival[];
  canSeat: boolean;
}) {
  const router = useRouter();
  const [seatingId, setSeatingId] = useState<string | null>(null);

  async function handleSeat(a: UpcomingArrival) {
    setSeatingId(a.id);
    const result = await setReservationStatusAction(slug, a.id, "SEATED");
    setSeatingId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${a.name} seated`);
    router.refresh();
  }

  return (
    <SectionCard
      icon={Users}
      title="Upcoming arrivals"
      description="Confirmed and pending guests still to come today."
      headerRight={
        <Link href={`/r/${slug}/reservations`} className="text-[13.5px] font-semibold text-primary hover:underline">
          View all
        </Link>
      }
    >
      <div className="divide-y divide-line-divider border-t border-line-divider">
        {arrivals.map((a) => {
          const sc = STATUS_COLORS[a.status];
          return (
            <div key={a.id} className="flex flex-wrap items-center gap-3 px-7 py-4">
              <div className="w-16 shrink-0 text-[13.5px] font-bold text-ink">{a.time}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-ink">{a.name}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
                  Party of {a.party}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11.5px] font-bold ${
                      a.table ? "bg-neutral-soft text-[#475569]" : "bg-warning-soft text-warning"
                    }`}
                  >
                    {a.table ?? "No table"}
                  </span>
                </div>
              </div>
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"
                style={{ backgroundColor: sc.bg, color: sc.text }}
              >
                <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: sc.bar }} />
                {STATUS_LABELS[a.status]}
              </span>
              {canSeat && (
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`Seat ${a.name}`}
                  disabled={seatingId === a.id}
                  onClick={() => handleSeat(a)}
                  className="h-10 rounded-xl border-[#D5DAEA] text-[13.5px] font-semibold text-ink"
                >
                  {seatingId === a.id ? <Loader2 className="size-4 animate-spin" /> : "Seat"}
                </Button>
              )}
            </div>
          );
        })}
        {arrivals.length === 0 && (
          <p className="px-7 py-10 text-center text-sm text-ink-muted">No more arrivals today.</p>
        )}
      </div>
    </SectionCard>
  );
}
