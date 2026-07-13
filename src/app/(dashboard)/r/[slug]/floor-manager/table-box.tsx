"use client";

import { cn } from "@/lib/utils";
import type { TableShape } from "@/generated/prisma/client";
import type { TableFloorStatus, TableStatusReservation } from "@/lib/table-status";

const STATUS_STYLES: Record<TableFloorStatus, string> = {
  AVAILABLE: "border-border bg-muted text-muted-foreground",
  RESERVED_SOON: "border-amber-500/50 bg-amber-500/10 text-amber-700",
  SEATED: "border-emerald-500/50 bg-emerald-500/10 text-emerald-700",
};

function sizeClass(capacity: number) {
  // min-h rather than a fixed h- so a table with a reservation on it (a third
  // line of text -- the guest name) grows instead of having flexbox silently
  // shrink that line toward zero height inside a box too small to fit it.
  if (capacity <= 2) return "min-h-14 w-14";
  if (capacity <= 4) return "min-h-20 w-20";
  return "min-h-24 w-24";
}

export function TableBox({
  number,
  capacity,
  shape,
  posX,
  posY,
  status,
  reservation,
  editMode,
  onClick,
  onPointerDownDrag,
  onToggleShape,
}: {
  number: string;
  capacity: number;
  shape: TableShape;
  posX: number;
  posY: number;
  status: TableFloorStatus;
  reservation: TableStatusReservation | null;
  editMode: boolean;
  onClick?: () => void;
  onPointerDownDrag?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onToggleShape?: () => void;
}) {
  const clickable = !editMode && (status === "AVAILABLE" || status === "SEATED");

  return (
    <div
      className={cn(
        "absolute flex flex-col items-center justify-center gap-0.5 border-2 p-1 text-center text-xs font-medium shadow-sm select-none",
        sizeClass(capacity),
        shape === "ROUND" ? "rounded-full" : "rounded-[5px]",
        STATUS_STYLES[status],
        editMode ? "cursor-grab active:cursor-grabbing" : clickable ? "cursor-pointer hover:brightness-95" : ""
      )}
      style={{ left: posX, top: posY }}
      onPointerDown={editMode ? onPointerDownDrag : undefined}
      onClick={clickable ? onClick : undefined}
    >
      <span className="font-semibold">Table {number}</span>
      <span>{capacity} seats</span>
      {reservation && <span className="w-full truncate">{reservation.customerName}</span>}
      {editMode && (
        <button
          type="button"
          className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full border border-border bg-background text-[10px]"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onToggleShape?.();
          }}
          aria-label="Toggle table shape"
        >
          {shape === "ROUND" ? "▢" : "○"}
        </button>
      )}
    </div>
  );
}
