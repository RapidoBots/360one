"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FloorViewport } from "./floor-viewport";
import { QuickSeatDialog } from "./quick-seat-dialog";
import { SeatedInfoDialog } from "./seated-info-dialog";
import { FloorSwitcher, type FloorOption } from "./floor-switcher";
import { getTableStatus, type TableStatusReservation } from "@/lib/table-status";
import { getEffectiveSize } from "@/lib/table-layout";
import { STATUS_COLOR, type SceneTable } from "./scene-engine";
import type { TableShape } from "@/generated/prisma/client";

export type FloorTable = {
  id: string;
  number: string;
  capacity: number;
  posX: number | null;
  posY: number | null;
  shape: TableShape;
  rotation: number;
  width: number | null;
  height: number | null;
  color: string | null;
  finish: string | null;
};

// The existing 2D canvas was 1600x700px -- reused here just as the basis for
// converting each table's existing posX/posY into the 3D room's metres, so
// today's layout carries over without re-placing every table. Phase 2's real
// 3D editing will persist metre coordinates directly and retire this.
const LEGACY_CANVAS_W = 1600;
const LEGACY_CANVAS_H = 700;
const PX_PER_METRE = 80;

const STATUS_MAP = { AVAILABLE: "available", RESERVED_SOON: "soon", SEATED: "seated" } as const;
const FINISHES = new Set(["wood", "matte", "satin", "gloss", "metal"]);
function asFinish(f: string | null): SceneTable["finish"] {
  return f && FINISHES.has(f) ? (f as SceneTable["finish"]) : "wood";
}

const LEGEND: { label: string; status: SceneTable["status"] }[] = [
  { label: "Available", status: "available" },
  { label: "Reserved soon", status: "soon" },
  { label: "Seated", status: "seated" },
];

export function FloorPlan({
  slug,
  tables,
  floors,
  currentFloorId,
  floorWidth,
  floorDepth,
  reservations,
  timeZone,
  canEdit = true,
}: {
  slug: string;
  tables: FloorTable[];
  floors: FloorOption[];
  currentFloorId: string;
  floorWidth: number;
  floorDepth: number;
  reservations: TableStatusReservation[];
  timeZone: string;
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [now, setNow] = useState(() => new Date());
  const [quickSeat, setQuickSeat] = useState<{ id: string; number: string } | null>(null);
  const [seatedInfo, setSeatedInfo] = useState<{ number: string; reservation: TableStatusReservation } | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const placed = useMemo(() => tables.filter((t) => t.posX != null && t.posY != null), [tables]);
  const unplaced = useMemo(() => tables.filter((t) => t.posX == null || t.posY == null), [tables]);

  const byId = useMemo(() => new Map(tables.map((t) => [t.id, t])), [tables]);

  const sceneTables: SceneTable[] = useMemo(
    () =>
      placed.map((t) => {
        const { status } = getTableStatus(t.id, reservations, now);
        const dayCount = reservations.filter((r) => r.tableId === t.id).length;
        const size = getEffectiveSize(t.capacity, t.width, t.height);
        return {
          id: t.id,
          name: `Table ${t.number}`,
          x: (t.posX! / LEGACY_CANVAS_W) * floorWidth - floorWidth / 2,
          z: (t.posY! / LEGACY_CANVAS_H) * floorDepth - floorDepth / 2,
          rotation: t.rotation,
          round: t.shape === "ROUND",
          width: size.width / PX_PER_METRE,
          depth: size.height / PX_PER_METRE,
          color: t.color ?? "#C99A62",
          finish: asFinish(t.finish),
          seats: t.capacity,
          status: STATUS_MAP[status],
          reservationCount: dayCount,
        };
      }),
    [placed, reservations, now, floorWidth, floorDepth]
  );

  function handleTableClick(id: string) {
    const t = byId.get(id);
    if (!t) return;
    const { status, reservation } = getTableStatus(id, reservations, now);
    if (status === "AVAILABLE" && canEdit) setQuickSeat({ id: t.id, number: t.number });
    if (status === "SEATED" && reservation) setSeatedInfo({ number: t.number, reservation });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight text-ink">Floor Manager</h1>
          <p className="mt-0.5 text-sm text-ink-muted">{floorWidth} × {floorDepth} m room</p>
        </div>
        <FloorSwitcher slug={slug} floors={floors} currentFloorId={currentFloorId} canEdit={canEdit} />
      </div>

      <div className="flex flex-wrap items-center gap-4 text-[13px] text-ink-muted">
        {LEGEND.map((l) => (
          <span key={l.status} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: STATUS_COLOR[l.status] }} />
            {l.label}
          </span>
        ))}
      </div>

      <div className="flex min-h-[560px] flex-1">
        <FloorViewport floorWidth={floorWidth} floorDepth={floorDepth} tables={sceneTables} onTableClick={handleTableClick} />
      </div>

      {unplaced.length > 0 && (
        <div className="rounded-[20px] border border-line-card bg-white p-5 shadow-card">
          <h2 className="text-sm font-bold text-ink">Unplaced tables</h2>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            These tables aren&apos;t on the floor plan yet. Placing them is coming in the next update.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {unplaced.map((table) => (
              <span key={table.id} className="rounded-full bg-neutral-soft px-3 py-1.5 text-[13px] font-semibold text-[#334155]">
                Table {table.number} ({table.capacity} seats)
              </span>
            ))}
          </div>
        </div>
      )}

      <QuickSeatDialog
        open={quickSeat !== null}
        onOpenChange={(open) => !open && setQuickSeat(null)}
        slug={slug}
        tableId={quickSeat?.id ?? null}
        tableNumber={quickSeat?.number ?? ""}
        timeZone={timeZone}
        onSeated={() => router.refresh()}
      />
      <SeatedInfoDialog
        open={seatedInfo !== null}
        onOpenChange={(open) => !open && setSeatedInfo(null)}
        slug={slug}
        tableNumber={seatedInfo?.number ?? ""}
        reservation={seatedInfo?.reservation ?? null}
        onFreed={() => router.refresh()}
        canEdit={canEdit}
      />
    </div>
  );
}
