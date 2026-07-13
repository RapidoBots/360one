"use client";

import { cn } from "@/lib/utils";
import type { TableShape } from "@/generated/prisma/client";
import type { TableFloorStatus, TableStatusReservation } from "@/lib/table-status";

// Status still wins on the border so availability stays glanceable even
// though each table's fill color is now just a per-table identity color.
const STATUS_BORDER: Partial<Record<TableFloorStatus, string>> = {
  RESERVED_SOON: "border-amber-500",
  SEATED: "border-emerald-500",
};

const TABLE_COLORS = [
  { bg: "bg-blue-500/10", text: "text-blue-700", border: "border-blue-400/60" },
  { bg: "bg-purple-500/10", text: "text-purple-700", border: "border-purple-400/60" },
  { bg: "bg-pink-500/10", text: "text-pink-700", border: "border-pink-400/60" },
  { bg: "bg-cyan-500/10", text: "text-cyan-700", border: "border-cyan-400/60" },
  { bg: "bg-indigo-500/10", text: "text-indigo-700", border: "border-indigo-400/60" },
  { bg: "bg-teal-500/10", text: "text-teal-700", border: "border-teal-400/60" },
  { bg: "bg-rose-500/10", text: "text-rose-700", border: "border-rose-400/60" },
  { bg: "bg-violet-500/10", text: "text-violet-700", border: "border-violet-400/60" },
];

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

function tableColor(number: string) {
  return TABLE_COLORS[hashString(number) % TABLE_COLORS.length]!;
}

function sizeClass(capacity: number) {
  // min-h rather than a fixed h- so a table with a reservation on it (a third
  // line of text -- the guest name) grows instead of having flexbox silently
  // shrink that line toward zero height inside a box too small to fit it.
  if (capacity <= 2) return "min-h-14 w-14";
  if (capacity <= 4) return "min-h-20 w-20";
  return "min-h-24 w-24";
}

type ChairSide = "top" | "right" | "bottom" | "left";
const CHAIR_SIDES: ChairSide[] = ["top", "right", "bottom", "left"];

function chairsBySide(capacity: number): Record<ChairSide, number> {
  const counts: Record<ChairSide, number> = { top: 0, right: 0, bottom: 0, left: 0 };
  for (let i = 0; i < capacity; i++) counts[CHAIR_SIDES[i % 4]!]++;
  return counts;
}

function chairOffsets(count: number): number[] {
  return Array.from({ length: count }, (_, i) => ((i + 1) / (count + 1)) * 100);
}

function chairStyle(side: ChairSide, percent: number): React.CSSProperties {
  const along = `${percent}%`;
  switch (side) {
    case "top":
      return { top: -8, left: along, transform: "translateX(-50%)" };
    case "bottom":
      return { bottom: -8, left: along, transform: "translateX(-50%)" };
    case "left":
      return { left: -8, top: along, transform: "translateY(-50%)" };
    case "right":
      return { right: -8, top: along, transform: "translateY(-50%)" };
  }
}

function Chairs({ capacity }: { capacity: number }) {
  const counts = chairsBySide(capacity);
  return (
    <>
      {CHAIR_SIDES.flatMap((side) =>
        chairOffsets(counts[side]).map((percent, i) => (
          <span
            key={`${side}-${i}`}
            className="absolute size-2 rounded-[2px] bg-amber-900/50"
            style={chairStyle(side, percent)}
          />
        ))
      )}
    </>
  );
}

export function TableBox({
  number,
  capacity,
  shape,
  posX,
  posY,
  status,
  reservation,
  dayReservations,
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
  dayReservations: TableStatusReservation[];
  editMode: boolean;
  onClick?: () => void;
  onPointerDownDrag?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onToggleShape?: () => void;
}) {
  const clickable = !editMode && (status === "AVAILABLE" || status === "SEATED");
  const color = tableColor(number);

  return (
    <div
      className="group absolute"
      style={{ left: posX, top: posY }}
      onPointerDown={editMode ? onPointerDownDrag : undefined}
    >
      <Chairs capacity={capacity} />
      <div
        className={cn(
          "relative flex flex-col items-center justify-center gap-0.5 border-2 p-1 text-center text-xs font-medium shadow-sm select-none",
          sizeClass(capacity),
          shape === "ROUND" ? "rounded-full" : "rounded-[5px]",
          color.bg,
          color.text,
          STATUS_BORDER[status] ?? color.border,
          editMode ? "cursor-grab active:cursor-grabbing" : clickable ? "cursor-pointer hover:brightness-95" : ""
        )}
        onClick={clickable ? onClick : undefined}
      >
        <span className="font-semibold">Table {number}</span>
        <span>{capacity} seats</span>
        {reservation && <span className="w-full truncate">{reservation.customerName}</span>}
        {dayReservations.length > 0 && (
          <span className="absolute -top-2 -left-2 flex size-5 items-center justify-center rounded-full border border-border bg-background text-[10px] font-semibold text-foreground">
            {dayReservations.length}
          </span>
        )}
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

      {dayReservations.length > 0 && (
        <div className="pointer-events-none absolute top-full left-1/2 z-20 mt-2 hidden w-52 -translate-x-1/2 rounded-[5px] border border-border bg-popover p-2.5 text-left text-xs text-popover-foreground shadow-md group-hover:block">
          <p className="mb-1.5 font-semibold">
            {dayReservations.length} reservation{dayReservations.length === 1 ? "" : "s"} today
          </p>
          <ul className="space-y-1">
            {dayReservations.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2">
                <span>{r.startsAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                <span className="truncate text-muted-foreground">
                  {r.customerName} · {r.partySize}p
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
