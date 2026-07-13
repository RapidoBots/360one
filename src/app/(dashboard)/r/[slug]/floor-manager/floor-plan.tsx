"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TableBox } from "./table-box";
import { QuickSeatDialog } from "./quick-seat-dialog";
import { SeatedInfoDialog } from "./seated-info-dialog";
import { updateTableLayoutAction } from "./actions";
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

const CANVAS_WIDTH = 1600;
const CANVAS_HEIGHT = 700;
const TABLE_BOX_SIZE = 96; // matches table-box.tsx's largest size tier (h-24/w-24)
const DEFAULT_DROP_POSITION = { x: 20, y: 20 };

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
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ tableId: string; offsetX: number; offsetY: number } | null>(null);

  const [editMode, setEditMode] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(() =>
    Object.fromEntries(
      tables.filter((t) => t.posX != null && t.posY != null).map((t) => [t.id, { x: t.posX!, y: t.posY! }])
    )
  );
  const [shapes, setShapes] = useState<Record<string, TableShape>>(() =>
    Object.fromEntries(tables.map((t) => [t.id, t.shape]))
  );
  const [quickSeat, setQuickSeat] = useState<{ id: string; number: string } | null>(null);
  const [seatedInfo, setSeatedInfo] = useState<{ number: string; reservation: TableStatusReservation } | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const placed = tables.filter((t) => positions[t.id]);
  const unplaced = tables.filter((t) => !positions[t.id]);

  function handlePointerDown(tableId: string, e: React.PointerEvent<HTMLDivElement>) {
    if (!editMode || !canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const pos = positions[tableId] ?? DEFAULT_DROP_POSITION;
    dragState.current = {
      tableId,
      offsetX: e.clientX - canvasRect.left - pos.x,
      offsetY: e.clientY - canvasRect.top - pos.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragState.current;
    if (!drag || !canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(CANVAS_WIDTH - TABLE_BOX_SIZE, e.clientX - canvasRect.left - drag.offsetX));
    const y = Math.max(0, Math.min(CANVAS_HEIGHT - TABLE_BOX_SIZE, e.clientY - canvasRect.top - drag.offsetY));
    setPositions((prev) => ({ ...prev, [drag.tableId]: { x, y } }));
  }

  async function handlePointerUp() {
    const drag = dragState.current;
    dragState.current = null;
    if (!drag) return;
    const pos = positions[drag.tableId];
    const shape = shapes[drag.tableId];
    if (!pos || !shape) return;
    await updateTableLayoutAction(slug, drag.tableId, { posX: pos.x, posY: pos.y, shape });
    router.refresh();
  }

  async function handlePlaceFromTray(tableId: string) {
    setPositions((prev) => ({ ...prev, [tableId]: DEFAULT_DROP_POSITION }));
    const shape = shapes[tableId];
    if (!shape) return;
    await updateTableLayoutAction(slug, tableId, { posX: DEFAULT_DROP_POSITION.x, posY: DEFAULT_DROP_POSITION.y, shape });
    router.refresh();
  }

  async function handleToggleShape(tableId: string) {
    const nextShape: TableShape = shapes[tableId] === "ROUND" ? "SQUARE" : "ROUND";
    setShapes((prev) => ({ ...prev, [tableId]: nextShape }));
    const pos = positions[tableId];
    if (!pos) return;
    await updateTableLayoutAction(slug, tableId, { posX: pos.x, posY: pos.y, shape: nextShape });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Floor Manager</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {STATUS_LEGEND.map((s) => (
              <span key={s.label} className="flex items-center gap-1.5">
                <span className={`size-2.5 rounded-full ${s.dot}`} />
                {s.label}
              </span>
            ))}
          </div>
          <Button
            variant={editMode ? "default" : "outline"}
            className="h-11 px-5 text-base"
            onClick={() => setEditMode((v) => !v)}
          >
            {editMode ? "Done" : "Edit Layout"}
          </Button>
        </div>
      </div>

      {unplaced.length > 0 && !editMode && (
        <div className="flex items-center justify-between rounded-[5px] border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-base">
          <span>{unplaced.length} table{unplaced.length === 1 ? "" : "s"} aren&apos;t on the floor plan yet.</span>
          <Button variant="outline" className="h-9" onClick={() => setEditMode(true)}>
            Arrange them
          </Button>
        </div>
      )}

      <div
        ref={canvasRef}
        className="relative overflow-auto rounded-[5px] border border-border bg-muted/20"
        style={{ width: "100%", maxWidth: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {placed.map((table) => {
          const pos = positions[table.id]!;
          const shape = shapes[table.id]!;
          const { status, reservation } = getTableStatus(table.id, reservations, now);
          const dayReservations = reservations
            .filter((r) => r.tableId === table.id)
            .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
          return (
            <TableBox
              key={table.id}
              number={table.number}
              capacity={table.capacity}
              shape={shape}
              posX={pos.x}
              posY={pos.y}
              status={status}
              reservation={reservation}
              dayReservations={dayReservations}
              editMode={editMode}
              onPointerDownDrag={(e) => handlePointerDown(table.id, e)}
              onToggleShape={() => handleToggleShape(table.id)}
              onClick={() => {
                if (status === "AVAILABLE") setQuickSeat({ id: table.id, number: table.number });
                if (status === "SEATED" && reservation) setSeatedInfo({ number: table.number, reservation });
              }}
            />
          );
        })}
      </div>

      {editMode && unplaced.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-base font-semibold">Unplaced tables</h2>
          <p className="text-sm text-muted-foreground">
            Click a table to drop it onto the canvas, then drag it into place.
          </p>
          <div className="flex flex-wrap gap-2">
            {unplaced.map((table) => (
              <button
                key={table.id}
                type="button"
                className="rounded-[5px] border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
                onClick={() => handlePlaceFromTray(table.id)}
              >
                Table {table.number} ({table.capacity} seats)
              </button>
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
