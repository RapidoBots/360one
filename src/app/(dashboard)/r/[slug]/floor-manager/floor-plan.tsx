"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TableBox } from "./table-box";
import { QuickSeatDialog } from "./quick-seat-dialog";
import { SeatedInfoDialog } from "./seated-info-dialog";
import { getTableStatus, type TableStatusReservation } from "@/lib/table-status";
import type { TableShape } from "@/generated/prisma/client";

export type FloorTable = {
  id: string;
  number: string;
  capacity: number;
  posX: number | null;
  posY: number | null;
  shape: TableShape;
};

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 700;

const STATUS_LEGEND: { label: string; dot: string }[] = [
  { label: "Available", dot: "bg-muted-foreground/40" },
  { label: "Reserved soon", dot: "bg-amber-500" },
  { label: "Seated", dot: "bg-emerald-500" },
];

export function FloorPlan({
  slug,
  tables,
  reservations,
}: {
  slug: string;
  tables: FloorTable[];
  reservations: TableStatusReservation[];
}) {
  const router = useRouter();
  const [now, setNow] = useState(() => new Date());
  const [quickSeat, setQuickSeat] = useState<{ id: string; number: string } | null>(null);
  const [seatedInfo, setSeatedInfo] = useState<{ number: string; reservation: TableStatusReservation } | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const placed = tables.filter((t) => t.posX != null && t.posY != null);
  const unplacedCount = tables.length - placed.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Floor Manager</h1>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {STATUS_LEGEND.map((s) => (
            <span key={s.label} className="flex items-center gap-1.5">
              <span className={`size-2.5 rounded-full ${s.dot}`} />
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {unplacedCount > 0 && (
        <div className="rounded-[5px] border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-base">
          {unplacedCount} table{unplacedCount === 1 ? "" : "s"} aren&apos;t on the floor plan yet.
        </div>
      )}

      <div
        className="relative overflow-auto rounded-[5px] border border-border bg-muted/20"
        style={{ width: "100%", maxWidth: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
      >
        {placed.map((table) => {
          const { status, reservation } = getTableStatus(table.id, reservations, now);
          return (
            <TableBox
              key={table.id}
              number={table.number}
              capacity={table.capacity}
              shape={table.shape}
              posX={table.posX!}
              posY={table.posY!}
              status={status}
              reservation={reservation}
              editMode={false}
              onClick={() => {
                if (status === "AVAILABLE") setQuickSeat({ id: table.id, number: table.number });
                if (status === "SEATED" && reservation) setSeatedInfo({ number: table.number, reservation });
              }}
            />
          );
        })}
      </div>

      <QuickSeatDialog
        open={quickSeat !== null}
        onOpenChange={(open) => !open && setQuickSeat(null)}
        slug={slug}
        tableId={quickSeat?.id ?? null}
        tableNumber={quickSeat?.number ?? ""}
        onSeated={() => router.refresh()}
      />
      <SeatedInfoDialog
        open={seatedInfo !== null}
        onOpenChange={(open) => !open && setSeatedInfo(null)}
        slug={slug}
        tableNumber={seatedInfo?.number ?? ""}
        reservation={seatedInfo?.reservation ?? null}
        onFreed={() => router.refresh()}
      />
    </div>
  );
}
