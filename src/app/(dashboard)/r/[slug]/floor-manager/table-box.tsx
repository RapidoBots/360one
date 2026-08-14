"use client";

import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getEffectiveSize, getChairCounts } from "@/lib/table-layout";
import type { TableShape } from "@/generated/prisma/client";
import type { TableFloorStatus, TableStatusReservation } from "@/lib/table-status";

// Status wins over any per-table identity -- the whole box is colored by
// status (a traffic-light read at a glance), not just a border accent.
const STATUS_COLORS: Record<TableFloorStatus, { bg: string; border: string; text: string }> = {
  AVAILABLE: { bg: "bg-emerald-500", border: "border-emerald-600", text: "text-white" },
  RESERVED_SOON: { bg: "bg-amber-400", border: "border-amber-500", text: "text-amber-950" },
  SEATED: { bg: "bg-red-500", border: "border-red-600", text: "text-white" },
};

const SHAPE_LABELS: Record<TableShape, string> = {
  SQUARE: "Square",
  RECTANGLE: "Rectangle",
  ROUND: "Round",
};

type ChairSide = "top" | "right" | "bottom" | "left";
const CHAIR_SIDES: ChairSide[] = ["top", "right", "bottom", "left"];

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

function Chairs({ counts }: { counts: Record<ChairSide, number> }) {
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

export type TableSettings = {
  shape: TableShape;
  rotation: number;
  width: number | null;
  height: number | null;
  chairsTop: number | null;
  chairsRight: number | null;
  chairsBottom: number | null;
  chairsLeft: number | null;
};

function SettingsPanel({
  capacity,
  settings,
  onSave,
}: {
  capacity: number;
  settings: TableSettings;
  onSave: (next: TableSettings) => void;
}) {
  const [open, setOpen] = useState(false);
  const [shape, setShape] = useState(settings.shape);
  const [rotation, setRotation] = useState(settings.rotation);
  const [width, setWidth] = useState(settings.width);
  const [height, setHeight] = useState(settings.height);
  const [chairsTop, setChairsTop] = useState(settings.chairsTop);
  const [chairsRight, setChairsRight] = useState(settings.chairsRight);
  const [chairsBottom, setChairsBottom] = useState(settings.chairsBottom);
  const [chairsLeft, setChairsLeft] = useState(settings.chairsLeft);

  useEffect(() => {
    if (!open) return;
    setShape(settings.shape);
    setRotation(settings.rotation);
    setWidth(settings.width);
    setHeight(settings.height);
    setChairsTop(settings.chairsTop);
    setChairsRight(settings.chairsRight);
    setChairsBottom(settings.chairsBottom);
    setChairsLeft(settings.chairsLeft);
  }, [open, settings]);

  const defaultSize = getEffectiveSize(capacity, null, null);
  const defaultChairs = getChairCounts(capacity, null, null, null, null);

  function handleSave() {
    onSave({ shape, rotation, width, height, chairsTop, chairsRight, chairsBottom, chairsLeft });
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        onPointerDown={(e) => e.stopPropagation()}
        render={
          <button
            type="button"
            className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full border border-border bg-background text-[10px]"
            aria-label="Table settings"
          />
        }
      >
        <Settings className="size-3" />
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-3 p-3" onPointerDown={(e) => e.stopPropagation()}>
        <div className="space-y-1.5">
          <Label htmlFor="tableShape">Shape</Label>
          <Select value={shape} onValueChange={(v) => v && setShape(v as TableShape)}>
            <SelectTrigger id="tableShape" className="h-9 w-full text-sm">
              <SelectValue>{(value: TableShape) => SHAPE_LABELS[value]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SHAPE_LABELS) as TableShape[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {SHAPE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tableRotation">Rotation (degrees)</Label>
          <Input
            id="tableRotation"
            type="number"
            step={15}
            className="h-9 text-sm"
            value={rotation}
            onChange={(e) => setRotation(Number(e.target.value))}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="tableWidth">Width (px)</Label>
            <Input
              id="tableWidth"
              type="number"
              min={20}
              className="h-9 text-sm"
              placeholder={String(defaultSize.width)}
              value={width ?? ""}
              onChange={(e) => setWidth(e.target.value === "" ? null : Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tableHeight">Height (px)</Label>
            <Input
              id="tableHeight"
              type="number"
              min={20}
              className="h-9 text-sm"
              placeholder={String(defaultSize.height)}
              value={height ?? ""}
              onChange={(e) => setHeight(e.target.value === "" ? null : Number(e.target.value))}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Chairs per side</Label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              aria-label="Chairs on top"
              type="number"
              min={0}
              className="h-9 text-sm"
              placeholder={`Top: ${defaultChairs.top}`}
              value={chairsTop ?? ""}
              onChange={(e) => setChairsTop(e.target.value === "" ? null : Number(e.target.value))}
            />
            <Input
              aria-label="Chairs on right"
              type="number"
              min={0}
              className="h-9 text-sm"
              placeholder={`Right: ${defaultChairs.right}`}
              value={chairsRight ?? ""}
              onChange={(e) => setChairsRight(e.target.value === "" ? null : Number(e.target.value))}
            />
            <Input
              aria-label="Chairs on bottom"
              type="number"
              min={0}
              className="h-9 text-sm"
              placeholder={`Bottom: ${defaultChairs.bottom}`}
              value={chairsBottom ?? ""}
              onChange={(e) => setChairsBottom(e.target.value === "" ? null : Number(e.target.value))}
            />
            <Input
              aria-label="Chairs on left"
              type="number"
              min={0}
              className="h-9 text-sm"
              placeholder={`Left: ${defaultChairs.left}`}
              value={chairsLeft ?? ""}
              onChange={(e) => setChairsLeft(e.target.value === "" ? null : Number(e.target.value))}
            />
          </div>
        </div>

        <Button type="button" className="h-9 w-full text-sm" onClick={handleSave}>
          Save
        </Button>
      </PopoverContent>
    </Popover>
  );
}

export function TableBox({
  number,
  capacity,
  shape,
  rotation,
  width,
  height,
  chairsTop,
  chairsRight,
  chairsBottom,
  chairsLeft,
  posX,
  posY,
  status,
  reservation,
  dayReservations,
  editMode,
  onClick,
  onPointerDownDrag,
  onSettingsChange,
}: {
  number: string;
  capacity: number;
  shape: TableShape;
  rotation: number;
  width: number | null;
  height: number | null;
  chairsTop: number | null;
  chairsRight: number | null;
  chairsBottom: number | null;
  chairsLeft: number | null;
  posX: number;
  posY: number;
  status: TableFloorStatus;
  reservation: TableStatusReservation | null;
  dayReservations: TableStatusReservation[];
  editMode: boolean;
  onClick?: () => void;
  onPointerDownDrag?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onSettingsChange?: (settings: TableSettings) => void;
}) {
  const clickable = !editMode && (status === "AVAILABLE" || status === "SEATED");
  const color = STATUS_COLORS[status];
  const size = getEffectiveSize(capacity, width, height);
  const chairCounts = getChairCounts(capacity, chairsTop, chairsRight, chairsBottom, chairsLeft);
  const [tooltipOpen, setTooltipOpen] = useState(false);

  return (
    <div
      className={cn("group absolute", editMode && "touch-none")}
      style={{ left: posX, top: posY, transform: rotation ? `rotate(${rotation}deg)` : undefined }}
      onPointerDown={editMode ? onPointerDownDrag : undefined}
    >
      <Chairs counts={chairCounts} />
      <div
        className={cn(
          "relative flex flex-col items-center justify-center gap-0.5 border-2 p-1 text-center text-xs font-medium shadow-sm select-none",
          shape === "ROUND" ? "rounded-full" : "rounded-[5px]",
          color.bg,
          color.text,
          color.border,
          editMode ? "cursor-grab active:cursor-grabbing" : clickable ? "cursor-pointer hover:brightness-95" : ""
        )}
        style={{ width: size.width, minHeight: size.height }}
        onClick={clickable ? onClick : undefined}
      >
        <span className="font-semibold">Table {number}</span>
        <span>{capacity} seats</span>
        {reservation && <span className="w-full truncate">{reservation.customerName}</span>}
        {dayReservations.length > 0 && (
          <button
            type="button"
            className="absolute -top-2 -left-2 flex size-5 items-center justify-center rounded-full border border-border bg-background text-[10px] font-semibold text-foreground"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setTooltipOpen((v) => !v);
            }}
            aria-label={`${dayReservations.length} reservation${dayReservations.length === 1 ? "" : "s"} today`}
            aria-expanded={tooltipOpen}
          >
            {dayReservations.length}
          </button>
        )}
        {editMode && onSettingsChange && (
          <SettingsPanel
            capacity={capacity}
            settings={{ shape, rotation, width, height, chairsTop, chairsRight, chairsBottom, chairsLeft }}
            onSave={onSettingsChange}
          />
        )}
      </div>

      {dayReservations.length > 0 && (
        <div
          className={cn(
            "pointer-events-none absolute top-full left-1/2 z-20 mt-2 w-52 -translate-x-1/2 rounded-[5px] border border-border bg-popover p-2.5 text-left text-xs text-popover-foreground shadow-md",
            tooltipOpen ? "block" : "hidden group-hover:block"
          )}
        >
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
