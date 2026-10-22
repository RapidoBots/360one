"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { FieldLabel } from "@/components/ui/section-card";
import { getEffectiveSize, getChairCounts } from "@/lib/table-layout";
import type { TableLayoutInput } from "./actions";
import { STATUS_COLOR, type SceneTableStatus } from "./scene-engine";
import type { FloorTable } from "./floor-plan";
import type { TableShape } from "@/generated/prisma/client";

const SHAPE_OPTIONS: { value: TableShape; label: string }[] = [
  { value: "SQUARE", label: "Square" },
  { value: "RECTANGLE", label: "Rectangle" },
  { value: "ROUND", label: "Round" },
];
const FINISH_OPTIONS: { value: string; label: string }[] = [
  { value: "wood", label: "Natural wood" },
  { value: "matte", label: "Matte" },
  { value: "satin", label: "Satin" },
  { value: "gloss", label: "Glossy" },
  { value: "metal", label: "Brushed metal" },
];
const SWATCHES = ["#C99A62", "#8B5E3C", "#4A3427", "#E9E1D3", "#2F3A4A", "#1F2937", "#2B50E8", "#0F766E", "#B91C1C", "#D4A373", "#9CA3AF", "#F8FAFC"];
const STATUS_LABEL: Record<SceneTableStatus, string> = { available: "Available", soon: "Reserved soon", seated: "Seated" };

const fieldClass =
  "h-11 w-full rounded-xl border-line-input bg-white px-3.5 text-sm font-medium text-ink focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/16";

function num(input: HTMLInputElement | null): number {
  return input ? Number(input.value) : 0;
}

export function TableInspector({
  table,
  status,
  onApply,
  onClose,
}: {
  table: FloorTable;
  status: SceneTableStatus;
  onApply: (input: TableLayoutInput) => void;
  onClose: () => void;
}) {
  const [shape, setShape] = useState<TableShape>(table.shape);
  const [posX, setPosX] = useState(table.posX ?? 0);
  const [posY, setPosY] = useState(table.posY ?? 0);
  const [rotation, setRotation] = useState(table.rotation);
  const [width, setWidth] = useState<number | null>(table.width);
  const [height, setHeight] = useState<number | null>(table.height);
  const [color, setColor] = useState(table.color ?? "#C99A62");
  const [finish, setFinish] = useState(table.finish ?? "wood");
  const [chairsTop, setChairsTop] = useState<number | null>(table.chairsTop ?? null);
  const [chairsRight, setChairsRight] = useState<number | null>(table.chairsRight ?? null);
  const [chairsBottom, setChairsBottom] = useState<number | null>(table.chairsBottom ?? null);
  const [chairsLeft, setChairsLeft] = useState<number | null>(table.chairsLeft ?? null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setShape(table.shape);
    setPosX(table.posX ?? 0);
    setPosY(table.posY ?? 0);
    setRotation(table.rotation);
    setWidth(table.width);
    setHeight(table.height);
    setColor(table.color ?? "#C99A62");
    setFinish(table.finish ?? "wood");
    setChairsTop(table.chairsTop ?? null);
    setChairsRight(table.chairsRight ?? null);
    setChairsBottom(table.chairsBottom ?? null);
    setChairsLeft(table.chairsLeft ?? null);
    setSaved(false);
  }, [table]);

  const defaultSize = getEffectiveSize(table.capacity, null, null);
  const defaultChairs = getChairCounts(table.capacity, null, null, null, null);
  const sc = STATUS_COLOR[status];

  function markDirty() {
    setSaved(false);
  }

  function handleSave() {
    const input: TableLayoutInput = {
      posX,
      posY,
      shape,
      rotation,
      width,
      height,
      chairsTop,
      chairsRight,
      chairsBottom,
      chairsLeft,
      color,
      finish,
    };
    onApply(input);
    setSaved(true);
  }

  return (
    <aside className="flex w-[280px] shrink-0 flex-col overflow-hidden rounded-[20px] border border-line-card bg-white shadow-card">
      <div className="flex items-center justify-between gap-2 border-b border-line-divider px-4 py-3.5">
        <div className="min-w-0">
          <div className="text-lg font-extrabold tracking-tight text-ink">Table {table.number}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-muted">
            <span className="size-2 rounded-full" style={{ backgroundColor: sc }} />
            {STATUS_LABEL[status]} · {table.capacity} seats
          </div>
        </div>
        <button type="button" aria-label="Close inspector" onClick={onClose} className="flex size-8 shrink-0 items-center justify-center rounded-[10px] text-[#475569] hover:bg-[#F1F3F9]">
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-4 border-b border-line-divider pb-4">
          <label className="flex flex-col gap-2">
            <FieldLabel>Shape</FieldLabel>
            <NativeSelect compact className="h-10" value={shape} onChange={(e) => { setShape(e.target.value as TableShape); markDirty(); }}>
              {SHAPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </NativeSelect>
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            <label className="flex flex-col gap-2">
              <FieldLabel>X (m)</FieldLabel>
              <input type="number" step={0.1} className={fieldClass} value={posX} onChange={(e) => { setPosX(Number(e.target.value)); markDirty(); }} />
            </label>
            <label className="flex flex-col gap-2">
              <FieldLabel>Z (m)</FieldLabel>
              <input type="number" step={0.1} className={fieldClass} value={posY} onChange={(e) => { setPosY(Number(e.target.value)); markDirty(); }} />
            </label>
            <label className="flex flex-col gap-2">
              <FieldLabel>Angle (°)</FieldLabel>
              <input
                type="number" step={15} className={fieldClass} value={rotation}
                onChange={(e) => { setRotation(((Number(e.target.value) % 360) + 360) % 360); markDirty(); }}
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-2">
              <FieldLabel>Width (m)</FieldLabel>
              <input
                type="number" min={0.3} step={0.05} className={fieldClass}
                placeholder={defaultSize.width.toFixed(2)}
                value={width ?? ""}
                onChange={(e) => { setWidth(e.target.value === "" ? null : Number(e.target.value)); markDirty(); }}
              />
            </label>
            <label className="flex flex-col gap-2">
              <FieldLabel>Depth (m)</FieldLabel>
              <input
                type="number" min={0.3} step={0.05} className={fieldClass}
                placeholder={defaultSize.height.toFixed(2)}
                value={height ?? ""}
                onChange={(e) => { setHeight(e.target.value === "" ? null : Number(e.target.value)); markDirty(); }}
              />
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b border-line-divider py-4">
          <FieldLabel>Material</FieldLabel>
          <div className="flex flex-wrap items-center gap-2">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                onClick={() => { setColor(c); markDirty(); }}
                className={`size-[22px] rounded-full border-2 border-white ${color.toLowerCase() === c.toLowerCase() ? "ring-2 ring-primary" : "ring-1 ring-line-input"}`}
                style={{ backgroundColor: c }}
              />
            ))}
            <input
              type="color" aria-label="Custom color" value={color}
              onChange={(e) => { setColor(e.target.value); markDirty(); }}
              className="size-[26px] shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-0"
            />
          </div>
          <label className="flex flex-col gap-2">
            <FieldLabel>Finish</FieldLabel>
            <NativeSelect compact className="h-10" value={finish} onChange={(e) => { setFinish(e.target.value); markDirty(); }}>
              {FINISH_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </NativeSelect>
          </label>
        </div>

        <div className="flex flex-col gap-3 py-4">
          <FieldLabel>Chairs per side</FieldLabel>
          <div className="grid grid-cols-2 gap-2.5">
            {([
              ["Top", chairsTop, setChairsTop, defaultChairs.top],
              ["Right", chairsRight, setChairsRight, defaultChairs.right],
              ["Bottom", chairsBottom, setChairsBottom, defaultChairs.bottom],
              ["Left", chairsLeft, setChairsLeft, defaultChairs.left],
            ] as const).map(([label, value, setter, fallback]) => (
              <label key={label} className="flex flex-col gap-1.5">
                <span className="text-xs text-ink-muted">{label}</span>
                <input
                  type="number" min={0} max={16} className={`${fieldClass} h-9`}
                  placeholder={String(fallback)}
                  value={value ?? ""}
                  onChange={(e) => { setter(e.target.value === "" ? null : Number(e.target.value)); markDirty(); }}
                  onBlur={(e) => setter(e.target.value === "" ? null : num(e.target))}
                />
              </label>
            ))}
          </div>
        </div>

      </div>

      <div className="flex items-center gap-2.5 border-t border-line-divider bg-surface-footer px-4 py-3.5">
        {saved && <span className="mr-auto text-[13px] font-semibold text-success">Updated</span>}
        <Button onClick={handleSave} className="h-10 w-full rounded-xl text-sm font-bold">
          Apply changes
        </Button>
      </div>
    </aside>
  );
}
