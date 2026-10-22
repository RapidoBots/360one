"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Redo2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FloorViewport } from "./floor-viewport";
import { TableInspector } from "./table-inspector";
import { FloorItemInspector } from "./floor-item-inspector";
import { FurnitureLibrary } from "./furniture-library";
import { QuickSeatDialog } from "./quick-seat-dialog";
import { SeatedInfoDialog } from "./seated-info-dialog";
import { FloorSwitcher, type FloorOption } from "./floor-switcher";
import { getTableStatus, type TableStatusReservation } from "@/lib/table-status";
import { getEffectiveSize } from "@/lib/table-layout";
import { updateTableLayoutAction, createFloorItemAction, updateFloorItemAction, deleteFloorItemAction, type TableLayoutInput } from "./actions";
import { FURNITURE_BY_ID, type FurnitureCatalogItem } from "./furniture-catalog";
import { STATUS_COLOR, type SceneTable, type SceneFurnitureItem } from "./scene-engine";
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
  chairsTop: number | null;
  chairsRight: number | null;
  chairsBottom: number | null;
  chairsLeft: number | null;
  color: string | null;
  finish: string | null;
};

export type PlacedFloorItem = {
  id: string;
  type: string;
  name: string;
  x: number;
  z: number;
  rotation: number;
  width: number;
  depth: number;
  height: number;
  color: string;
  finish: string;
  locked: boolean;
};

// Edit sessions are staged client-side (Save layout / Discard), matching the
// mockup's edit model -- nothing hits the server until Save, and Discard
// just drops this snapshot.
type Draft = { tables: FloorTable[]; items: PlacedFloorItem[] };

let tempIdSeq = 0;
function tempId(): string {
  return `temp-${Date.now()}-${tempIdSeq++}`;
}
function isTempId(id: string): boolean {
  return id.startsWith("temp-");
}

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
  items,
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
  items: PlacedFloorItem[];
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
  const [editMode, setEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedKind, setSelectedKind] = useState<"table" | "item" | null>(null);
  const [quickSeat, setQuickSeat] = useState<{ id: string; number: string } | null>(null);
  const [seatedInfo, setSeatedInfo] = useState<{ number: string; reservation: TableStatusReservation } | null>(null);
  // A single state object so every undo/redo/mutate transition is one atomic
  // setState call -- nesting setState calls inside another updater (e.g.
  // calling setUndoStack from within setDraft's updater) breaks under React
  // Strict Mode's double-invocation of updaters, which silently corrupts the
  // stacks with duplicate entries.
  const [session, setSession] = useState<{ draft: Draft; undoStack: Draft[]; redoStack: Draft[] } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  // While editing, every read goes through the draft; outside edit mode the
  // server props are the only source of truth.
  const activeTables = session?.draft.tables ?? tables;
  const activeItems = session?.draft.items ?? items;

  const placed = useMemo(() => activeTables.filter((t) => t.posX != null && t.posY != null), [activeTables]);
  const unplaced = useMemo(() => activeTables.filter((t) => t.posX == null || t.posY == null), [activeTables]);
  const byId = useMemo(() => new Map(activeTables.map((t) => [t.id, t])), [activeTables]);
  const itemById = useMemo(() => new Map(activeItems.map((i) => [i.id, i])), [activeItems]);
  const totalSeats = useMemo(() => activeTables.reduce((sum, t) => sum + t.capacity, 0), [activeTables]);

  const sceneTables: SceneTable[] = useMemo(
    () =>
      placed.map((t) => {
        const { status } = getTableStatus(t.id, reservations, now);
        const dayCount = reservations.filter((r) => r.tableId === t.id).length;
        const size = getEffectiveSize(t.capacity, t.width, t.height);
        return {
          id: t.id,
          name: `Table ${t.number}`,
          x: t.posX!,
          z: t.posY!,
          rotation: t.rotation,
          round: t.shape === "ROUND",
          width: size.width,
          depth: size.height,
          color: t.color ?? "#C99A62",
          finish: asFinish(t.finish),
          seats: t.capacity,
          status: STATUS_MAP[status],
          reservationCount: dayCount,
        };
      }),
    [placed, reservations, now]
  );
  const sceneById = useMemo(() => new Map(sceneTables.map((t) => [t.id, t])), [sceneTables]);

  const sceneItems: SceneFurnitureItem[] = useMemo(
    () =>
      activeItems.map((it) => ({
        id: it.id,
        kind: FURNITURE_BY_ID.get(it.type)?.kind ?? it.type,
        name: it.name,
        x: it.x,
        z: it.z,
        rotation: it.rotation,
        width: it.width,
        depth: it.depth,
        height: it.height,
        color: it.color,
        finish: asFinish(it.finish),
        locked: it.locked,
      })),
    [activeItems]
  );

  function handleSelect(id: string | null, kind: "table" | "item" | null) {
    if (editMode) {
      setSelectedId(id);
      setSelectedKind(kind);
      return;
    }
    if (!id || kind !== "table") return;
    const t = byId.get(id);
    if (!t) return;
    const { status, reservation } = getTableStatus(id, reservations, now);
    if (status === "AVAILABLE" && canEdit) setQuickSeat({ id: t.id, number: t.number });
    if (status === "SEATED" && reservation) setSeatedInfo({ number: t.number, reservation });
  }

  function mutate(fn: (d: Draft) => Draft) {
    setSession((cur) => {
      if (!cur) return cur;
      return { draft: fn(cur.draft), undoStack: [...cur.undoStack, cur.draft], redoStack: [] };
    });
  }

  function handleMove(id: string, kind: "table" | "item", x: number, z: number) {
    mutate((d) =>
      kind === "table"
        ? { ...d, tables: d.tables.map((t) => (t.id === id ? { ...t, posX: x, posY: z } : t)) }
        : { ...d, items: d.items.map((i) => (i.id === id ? { ...i, x, z } : i)) }
    );
  }

  function handleRotate(id: string, kind: "table" | "item", rotation: number) {
    mutate((d) =>
      kind === "table"
        ? { ...d, tables: d.tables.map((t) => (t.id === id ? { ...t, rotation } : t)) }
        : { ...d, items: d.items.map((i) => (i.id === id ? { ...i, rotation } : i)) }
    );
  }

  function handleResize(id: string, kind: "table" | "item", dims: { width: number; depth: number; height: number }) {
    mutate((d) =>
      kind === "table"
        ? { ...d, tables: d.tables.map((t) => (t.id === id ? { ...t, width: dims.width, height: dims.depth } : t)) }
        : { ...d, items: d.items.map((i) => (i.id === id ? { ...i, width: dims.width, depth: dims.depth, height: dims.height } : i)) }
    );
  }

  function handleApplyTable(id: string, input: TableLayoutInput) {
    mutate((d) => ({
      ...d,
      tables: d.tables.map((t) =>
        t.id === id
          ? {
              ...t,
              posX: input.posX,
              posY: input.posY,
              shape: input.shape,
              rotation: input.rotation ?? t.rotation,
              width: input.width ?? null,
              height: input.height ?? null,
              chairsTop: input.chairsTop ?? null,
              chairsRight: input.chairsRight ?? null,
              chairsBottom: input.chairsBottom ?? null,
              chairsLeft: input.chairsLeft ?? null,
              color: input.color ?? null,
              finish: input.finish ?? null,
            }
          : t
      ),
    }));
  }

  function handleApplyItem(id: string, patch: Partial<PlacedFloorItem>) {
    mutate((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
  }

  function handleDeleteSelected() {
    if (selectedKind !== "item" || !selectedId) return;
    mutate((d) => ({ ...d, items: d.items.filter((i) => i.id !== selectedId) }));
    closeInspector();
  }

  function handleDuplicateSelected() {
    if (selectedKind !== "item" || !selectedId) return;
    const item = itemById.get(selectedId);
    if (!item) return;
    const clone: PlacedFloorItem = { ...item, id: tempId(), x: item.x + 0.3, z: item.z + 0.3 };
    mutate((d) => ({ ...d, items: [...d.items, clone] }));
    setSelectedId(clone.id);
    setSelectedKind("item");
  }

  function handleNudge(dx: number, dz: number) {
    if (!selectedId || !selectedKind) return;
    if (selectedKind === "table") {
      const t = byId.get(selectedId);
      if (!t) return;
      handleMove(selectedId, "table", (t.posX ?? 0) + dx, (t.posY ?? 0) + dz);
    } else {
      const it = itemById.get(selectedId);
      if (!it) return;
      handleMove(selectedId, "item", it.x + dx, it.z + dz);
    }
  }

  function handleRotateStep(delta: number) {
    if (!selectedId || !selectedKind) return;
    const cur = selectedKind === "table" ? byId.get(selectedId) : itemById.get(selectedId);
    if (!cur) return;
    handleRotate(selectedId, selectedKind, ((cur.rotation + delta) % 360 + 360) % 360);
  }

  function handleUndo() {
    setSession((cur) => {
      if (!cur || cur.undoStack.length === 0) return cur;
      const prev = cur.undoStack[cur.undoStack.length - 1]!;
      return { draft: prev, undoStack: cur.undoStack.slice(0, -1), redoStack: [...cur.redoStack, cur.draft] };
    });
  }

  function handleRedo() {
    setSession((cur) => {
      if (!cur || cur.redoStack.length === 0) return cur;
      const next = cur.redoStack[cur.redoStack.length - 1]!;
      return { draft: next, undoStack: [...cur.undoStack, cur.draft], redoStack: cur.redoStack.slice(0, -1) };
    });
  }

  useEffect(() => {
    if (!editMode) return;
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === "z" && e.shiftKey) {
        e.preventDefault();
        handleRedo();
      } else if (ctrl && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
      } else if (ctrl && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      } else if (ctrl && e.key.toLowerCase() === "d") {
        e.preventDefault();
        handleDuplicateSelected();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        handleDeleteSelected();
      } else if (e.key === "Escape") {
        closeInspector();
      } else if (e.key === "[" || e.key === "]") {
        handleRotateStep(e.key === "[" ? -15 : 15);
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const step = (e.shiftKey ? 2 : 1) * 0.25;
        const [dx, dz] = e.key === "ArrowUp" ? [0, -step] : e.key === "ArrowDown" ? [0, step] : e.key === "ArrowLeft" ? [-step, 0] : [step, 0];
        handleNudge(dx, dz);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode, selectedId, selectedKind, session]);

  function handlePlaceFromTray(table: FloorTable, index: number) {
    // Spread newly-placed tables out a bit so they don't all land in one
    // stack in the middle of the room.
    const x = ((index % 3) - 1) * 1.5;
    const z = Math.floor(index / 3) * 1.5;
    mutate((d) => ({ ...d, tables: d.tables.map((t) => (t.id === table.id ? { ...t, posX: x, posY: z } : t)) }));
    setSelectedId(table.id);
    setSelectedKind("table");
  }

  function handlePlaceFurniture(catalog: FurnitureCatalogItem) {
    const item: PlacedFloorItem = {
      id: tempId(),
      type: catalog.id,
      name: catalog.name,
      x: 0,
      z: 0,
      rotation: 0,
      width: catalog.width,
      depth: catalog.depth,
      height: catalog.height,
      color: catalog.color,
      finish: "wood",
      locked: false,
    };
    mutate((d) => ({ ...d, items: [...d.items, item] }));
  }

  function enterEdit() {
    setSession({ draft: { tables, items }, undoStack: [], redoStack: [] });
    setEditMode(true);
  }

  function handleDiscard() {
    setSession(null);
    setEditMode(false);
    closeInspector();
  }

  async function handleSaveLayout() {
    if (!session) return;
    const draft = session.draft;
    setSaving(true);
    const origTablesById = new Map(tables.map((t) => [t.id, t]));
    const origItemsById = new Map(items.map((i) => [i.id, i]));

    for (const t of draft.tables) {
      const orig = origTablesById.get(t.id);
      if (!orig || JSON.stringify(orig) === JSON.stringify(t)) continue;
      await updateTableLayoutAction(slug, t.id, {
        posX: t.posX ?? 0,
        posY: t.posY ?? 0,
        shape: t.shape,
        rotation: t.rotation,
        width: t.width,
        height: t.height,
        chairsTop: t.chairsTop,
        chairsRight: t.chairsRight,
        chairsBottom: t.chairsBottom,
        chairsLeft: t.chairsLeft,
        color: t.color,
        finish: t.finish,
      });
    }

    for (const it of draft.items) {
      if (isTempId(it.id)) {
        await createFloorItemAction(slug, {
          floorId: currentFloorId,
          type: it.type,
          name: it.name,
          x: it.x,
          z: it.z,
          rotation: it.rotation,
          width: it.width,
          depth: it.depth,
          height: it.height,
          color: it.color,
          finish: it.finish,
          locked: it.locked,
        });
      } else {
        const orig = origItemsById.get(it.id);
        if (orig && JSON.stringify(orig) === JSON.stringify(it)) continue;
        await updateFloorItemAction(slug, it.id, {
          name: it.name,
          x: it.x,
          z: it.z,
          rotation: it.rotation,
          width: it.width,
          depth: it.depth,
          height: it.height,
          color: it.color,
          finish: it.finish,
          locked: it.locked,
        });
      }
    }
    for (const orig of items) {
      if (!draft.items.some((i) => i.id === orig.id)) {
        await deleteFloorItemAction(slug, orig.id);
      }
    }

    setSaving(false);
    setSession(null);
    setEditMode(false);
    closeInspector();
    router.refresh();
  }

  const selectedTable = selectedKind === "table" && selectedId ? byId.get(selectedId) : null;
  const selectedScene = selectedKind === "table" && selectedId ? sceneById.get(selectedId) : null;
  const selectedItem = selectedKind === "item" && selectedId ? itemById.get(selectedId) : null;

  function closeInspector() {
    setSelectedId(null);
    setSelectedKind(null);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight text-ink">Floor Manager</h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            {activeTables.length} tables · {totalSeats} seats · {floorWidth} × {floorDepth} m
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <FloorSwitcher slug={slug} floors={floors} currentFloorId={currentFloorId} canEdit={canEdit && !editMode} />
          {editMode ? (
            <>
              <div className="flex gap-0.5 rounded-xl border border-line-card bg-white p-1">
                <button
                  type="button"
                  aria-label="Undo"
                  onClick={handleUndo}
                  disabled={(session?.undoStack.length ?? 0) === 0}
                  className="flex size-8 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-footer hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <Undo2 className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Redo"
                  onClick={handleRedo}
                  disabled={(session?.redoStack.length ?? 0) === 0}
                  className="flex size-8 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-footer hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <Redo2 className="size-4" />
                </button>
              </div>
              <Button type="button" variant="outline" className="h-10 rounded-xl text-sm font-semibold" onClick={handleDiscard}>
                Discard
              </Button>
              <Button type="button" className="h-10 rounded-xl text-sm font-bold" onClick={handleSaveLayout} disabled={saving}>
                {saving ? "Saving..." : "Save layout"}
              </Button>
            </>
          ) : (
            canEdit && (
              <Button type="button" variant="outline" className="h-10 gap-2 rounded-xl text-sm font-semibold" onClick={enterEdit}>
                <Pencil className="size-3.5" />
                Edit Layout
              </Button>
            )
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-[13px] text-ink-muted">
        {LEGEND.map((l) => (
          <span key={l.status} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: STATUS_COLOR[l.status] }} />
            {l.label}
          </span>
        ))}
      </div>

      <div className="flex min-h-[560px] flex-1 gap-4">
        <FloorViewport
          floorWidth={floorWidth}
          floorDepth={floorDepth}
          tables={sceneTables}
          items={sceneItems}
          editMode={editMode}
          selectedId={selectedId}
          onSelect={handleSelect}
          onMove={handleMove}
          onRotate={handleRotate}
          onResize={handleResize}
        />
        {editMode && selectedTable && selectedScene && (
          <TableInspector
            table={selectedTable}
            status={selectedScene.status}
            onApply={(input) => handleApplyTable(selectedTable.id, input)}
            onClose={closeInspector}
          />
        )}
        {editMode && selectedItem && (
          <FloorItemInspector
            item={selectedItem}
            onApply={(patch) => handleApplyItem(selectedItem.id, patch)}
            onDelete={handleDeleteSelected}
            onClose={closeInspector}
          />
        )}
        {editMode && !selectedTable && !selectedItem && <FurnitureLibrary onPlace={handlePlaceFurniture} />}
      </div>

      {unplaced.length > 0 && (
        <div className="rounded-[20px] border border-line-card bg-white p-5 shadow-card">
          <h2 className="text-sm font-bold text-ink">Unplaced tables</h2>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            {editMode ? "Click a table to drop it onto the floor, then drag it into place." : "Switch to Edit Layout to place these on the floor."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {unplaced.map((table, i) =>
              editMode ? (
                <button
                  key={table.id}
                  type="button"
                  onClick={() => handlePlaceFromTray(table, i)}
                  className="rounded-full border border-line-input bg-white px-3 py-1.5 text-[13px] font-semibold text-ink hover:bg-surface-footer"
                >
                  Table {table.number} ({table.capacity} seats)
                </button>
              ) : (
                <span key={table.id} className="rounded-full bg-neutral-soft px-3 py-1.5 text-[13px] font-semibold text-[#334155]">
                  Table {table.number} ({table.capacity} seats)
                </span>
              )
            )}
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
