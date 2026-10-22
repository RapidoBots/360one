"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
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
import { updateTableLayoutAction, createFloorItemAction, updateFloorItemAction } from "./actions";
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

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const placed = useMemo(() => tables.filter((t) => t.posX != null && t.posY != null), [tables]);
  const unplaced = useMemo(() => tables.filter((t) => t.posX == null || t.posY == null), [tables]);
  const byId = useMemo(() => new Map(tables.map((t) => [t.id, t])), [tables]);
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

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
      items.map((it) => ({
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
    [items]
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

  async function handleMove(id: string, kind: "table" | "item", x: number, z: number) {
    if (kind === "table") {
      const t = byId.get(id);
      if (!t) return;
      await updateTableLayoutAction(slug, id, {
        posX: x,
        posY: z,
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
    } else {
      await updateFloorItemAction(slug, id, { x, z });
    }
    router.refresh();
  }

  async function handlePlaceFromTray(table: FloorTable, index: number) {
    // Spread newly-placed tables out a bit so they don't all land in one
    // stack in the middle of the room.
    const x = ((index % 3) - 1) * 1.5;
    const z = Math.floor(index / 3) * 1.5;
    await updateTableLayoutAction(slug, table.id, {
      posX: x,
      posY: z,
      shape: table.shape,
      rotation: table.rotation,
      width: table.width,
      height: table.height,
      chairsTop: table.chairsTop,
      chairsRight: table.chairsRight,
      chairsBottom: table.chairsBottom,
      chairsLeft: table.chairsLeft,
      color: table.color,
      finish: table.finish,
    });
    setSelectedId(table.id);
    setSelectedKind("table");
    router.refresh();
  }

  async function handlePlaceFurniture(catalog: FurnitureCatalogItem) {
    const result = await createFloorItemAction(slug, {
      floorId: currentFloorId,
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
    });
    if (result.ok) router.refresh();
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
          <p className="mt-0.5 text-sm text-ink-muted">{floorWidth} × {floorDepth} m room</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <FloorSwitcher slug={slug} floors={floors} currentFloorId={currentFloorId} canEdit={canEdit && !editMode} />
          {canEdit && (
            <Button
              type="button"
              variant={editMode ? "default" : "outline"}
              className="h-10 gap-2 rounded-xl text-sm font-semibold"
              onClick={() => {
                setEditMode((v) => !v);
                closeInspector();
              }}
            >
              <Pencil className="size-3.5" />
              {editMode ? "Done" : "Edit Layout"}
            </Button>
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
          onSelect={handleSelect}
          onMove={handleMove}
        />
        {editMode && selectedTable && selectedScene && (
          <TableInspector
            slug={slug}
            table={selectedTable}
            status={selectedScene.status}
            onSaved={() => router.refresh()}
            onClose={closeInspector}
          />
        )}
        {editMode && selectedItem && (
          <FloorItemInspector
            slug={slug}
            item={selectedItem}
            onSaved={() => router.refresh()}
            onDeleted={() => { closeInspector(); router.refresh(); }}
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
