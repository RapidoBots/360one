"use client";

import { useEffect, useState } from "react";
import { Loader2, Lock, Trash2, Unlock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { FieldLabel } from "@/components/ui/section-card";
import { deleteFloorItemAction, updateFloorItemAction } from "./actions";
import type { PlacedFloorItem } from "./floor-plan";

const FINISH_OPTIONS: { value: string; label: string }[] = [
  { value: "wood", label: "Natural wood" },
  { value: "matte", label: "Matte" },
  { value: "satin", label: "Satin" },
  { value: "gloss", label: "Glossy" },
  { value: "metal", label: "Brushed metal" },
];
const SWATCHES = ["#C99A62", "#8B5E3C", "#4A3427", "#E9E1D3", "#2F3A4A", "#1F2937", "#2B50E8", "#0F766E", "#B91C1C", "#D4A373", "#9CA3AF", "#F8FAFC"];

const fieldClass =
  "h-11 w-full rounded-xl border-line-input bg-white px-3.5 text-sm font-medium text-ink focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/16";

export function FloorItemInspector({
  slug,
  item,
  onSaved,
  onDeleted,
  onClose,
}: {
  slug: string;
  item: PlacedFloorItem;
  onSaved: () => void;
  onDeleted: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [x, setX] = useState(item.x);
  const [z, setZ] = useState(item.z);
  const [rotation, setRotation] = useState(item.rotation);
  const [width, setWidth] = useState(item.width);
  const [depth, setDepth] = useState(item.depth);
  const [height, setHeight] = useState(item.height);
  const [color, setColor] = useState(item.color);
  const [finish, setFinish] = useState(item.finish);
  const [locked, setLocked] = useState(item.locked);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setName(item.name);
    setX(item.x);
    setZ(item.z);
    setRotation(item.rotation);
    setWidth(item.width);
    setDepth(item.depth);
    setHeight(item.height);
    setColor(item.color);
    setFinish(item.finish);
    setLocked(item.locked);
    setError(null);
    setSaved(false);
  }, [item]);

  function markDirty() {
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await updateFloorItemAction(slug, item.id, { name, x, z, rotation, width, depth, height, color, finish, locked });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved(true);
    onSaved();
  }

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteFloorItemAction(slug, item.id);
    setDeleting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onDeleted();
  }

  return (
    <aside className="flex w-[280px] shrink-0 flex-col overflow-hidden rounded-[20px] border border-line-card bg-white shadow-card">
      <div className="flex items-center justify-between gap-2 border-b border-line-divider px-4 py-3.5">
        <div className="min-w-0 text-lg font-extrabold tracking-tight text-ink">{item.name}</div>
        <button type="button" aria-label="Close inspector" onClick={onClose} className="flex size-8 shrink-0 items-center justify-center rounded-[10px] text-[#475569] hover:bg-[#F1F3F9]">
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-4 border-b border-line-divider pb-4">
          <label className="flex flex-col gap-2">
            <FieldLabel>Name</FieldLabel>
            <input type="text" className={fieldClass} value={name} onChange={(e) => { setName(e.target.value); markDirty(); }} />
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            <label className="flex flex-col gap-2">
              <FieldLabel>X (m)</FieldLabel>
              <input type="number" step={0.1} className={fieldClass} value={x} onChange={(e) => { setX(Number(e.target.value)); markDirty(); }} />
            </label>
            <label className="flex flex-col gap-2">
              <FieldLabel>Z (m)</FieldLabel>
              <input type="number" step={0.1} className={fieldClass} value={z} onChange={(e) => { setZ(Number(e.target.value)); markDirty(); }} />
            </label>
            <label className="flex flex-col gap-2">
              <FieldLabel>Angle (°)</FieldLabel>
              <input
                type="number" step={15} className={fieldClass} value={rotation}
                onChange={(e) => { setRotation(((Number(e.target.value) % 360) + 360) % 360); markDirty(); }}
              />
            </label>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <label className="flex flex-col gap-2">
              <FieldLabel>Width (m)</FieldLabel>
              <input type="number" min={0.1} step={0.05} className={fieldClass} value={width} onChange={(e) => { setWidth(Number(e.target.value)); markDirty(); }} />
            </label>
            <label className="flex flex-col gap-2">
              <FieldLabel>Depth (m)</FieldLabel>
              <input type="number" min={0.1} step={0.05} className={fieldClass} value={depth} onChange={(e) => { setDepth(Number(e.target.value)); markDirty(); }} />
            </label>
            <label className="flex flex-col gap-2">
              <FieldLabel>Height (m)</FieldLabel>
              <input type="number" min={0.1} step={0.05} className={fieldClass} value={height} onChange={(e) => { setHeight(Number(e.target.value)); markDirty(); }} />
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

        <div className="flex items-center justify-between py-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            {locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
            Lock position
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={locked}
            onClick={() => { setLocked((v) => !v); markDirty(); }}
            className={`h-6 w-11 shrink-0 rounded-full transition-colors ${locked ? "bg-primary" : "bg-neutral-soft"}`}
          >
            <span className={`block size-5 translate-y-0.5 rounded-full bg-white transition-transform ${locked ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <div className="flex items-center gap-2.5 border-t border-line-divider bg-surface-footer px-4 py-3.5">
        <button
          type="button"
          aria-label="Delete item"
          onClick={handleDelete}
          disabled={deleting}
          className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-line-input text-destructive hover:bg-destructive/10"
        >
          {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        </button>
        {saved && <span className="text-[13px] font-semibold text-success">Saved</span>}
        <Button onClick={handleSave} disabled={saving} className="h-10 flex-1 rounded-xl text-sm font-bold">
          {saving ? <Loader2 className="size-4 animate-spin" /> : "Save changes"}
        </Button>
      </div>
    </aside>
  );
}
