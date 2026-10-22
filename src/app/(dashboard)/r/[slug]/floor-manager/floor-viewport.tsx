"use client";

import { useEffect, useRef, useState } from "react";
import { createFloorScene, type SceneTable, type SceneFurnitureItem, type SceneView, type SceneLight } from "./scene-engine";

export function FloorViewport({
  floorWidth,
  floorDepth,
  tables,
  items,
  editMode,
  onSelect,
  onMove,
}: {
  floorWidth: number;
  floorDepth: number;
  tables: SceneTable[];
  items: SceneFurnitureItem[];
  editMode: boolean;
  onSelect: (id: string | null, kind: "table" | "item" | null) => void;
  onMove: (id: string, kind: "table" | "item", x: number, z: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ReturnType<typeof createFloorScene> | null>(null);
  const [view, setView] = useState<SceneView>("3d");
  const [light, setLight] = useState<SceneLight>("day");
  const [zoomPct, setZoomPct] = useState(100);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    const engine = createFloorScene(canvasRef.current, containerRef.current);
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setFloor(floorWidth, floorDepth);
  }, [floorWidth, floorDepth]);

  useEffect(() => {
    engineRef.current?.setTables(tables);
  }, [tables]);

  useEffect(() => {
    engineRef.current?.setFurniture(items);
  }, [items]);

  useEffect(() => {
    engineRef.current?.onPick((pick) => onSelect(pick?.id ?? null, pick?.kind ?? null));
  }, [onSelect]);

  useEffect(() => {
    engineRef.current?.onMove(onMove);
  }, [onMove]);

  useEffect(() => {
    engineRef.current?.setEditable(editMode);
  }, [editMode]);

  useEffect(() => {
    engineRef.current?.setLight(light);
  }, [light]);

  useEffect(() => {
    engineRef.current?.frame(view);
  }, [view]);

  function applyZoom(fn: (e: ReturnType<typeof createFloorScene>) => void) {
    const e = engineRef.current;
    if (!e) return;
    fn(e);
    setZoomPct(e.zoomPct());
  }

  return (
    <div ref={containerRef} className="relative min-h-[560px] flex-1 overflow-hidden rounded-[20px] border border-line-card bg-[#E9ECF4] shadow-card">
      <canvas ref={canvasRef} tabIndex={0} aria-label="3D floor plan" className="absolute inset-0 size-full touch-none outline-none" />

      <div className="absolute right-3 top-3 flex flex-wrap justify-end gap-2">
        <div className="flex gap-0.5 rounded-xl border border-line-card bg-white/85 p-1 backdrop-blur-sm">
          {(["3d", "top", "front"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`h-8 rounded-lg px-2.5 text-[12.5px] font-semibold capitalize ${
                view === v ? "bg-white text-ink shadow-sm" : "text-ink-muted hover:text-ink"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="flex gap-0.5 rounded-xl border border-line-card bg-white/85 p-1 backdrop-blur-sm">
          {(["day", "evening"] as const).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={light === l}
              onClick={() => setLight(l)}
              className={`h-8 rounded-lg px-2.5 text-[12.5px] font-semibold capitalize ${
                light === l ? "bg-white text-ink shadow-sm" : "text-ink-muted hover:text-ink"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="flex gap-0.5 rounded-xl border border-line-card bg-white/85 p-1 backdrop-blur-sm">
          <button type="button" aria-label="Zoom out" onClick={() => applyZoom((e) => e.zoom(0.8))} className="h-8 w-8 rounded-lg text-sm font-semibold text-ink-muted hover:bg-surface-footer hover:text-ink">
            −
          </button>
          <button
            type="button"
            aria-label="Reset zoom"
            onClick={() => applyZoom((e) => e.zoom(100 / zoomPct))}
            className="h-8 min-w-[52px] rounded-lg text-[12.5px] font-semibold text-ink-muted hover:bg-surface-footer hover:text-ink"
          >
            {zoomPct}%
          </button>
          <button type="button" aria-label="Zoom in" onClick={() => applyZoom((e) => e.zoom(1.25))} className="h-8 w-8 rounded-lg text-sm font-semibold text-ink-muted hover:bg-surface-footer hover:text-ink">
            +
          </button>
        </div>
      </div>

      <div className="absolute bottom-3 left-3 rounded-xl border border-line-card bg-white/85 px-3 py-1.5 text-xs text-ink-muted backdrop-blur-sm">
        {editMode ? (
          <>
            <b className="text-ink">Drag</b> a table to move it · <b className="text-ink">Left-drag</b> empty space to orbit · <b className="text-ink">Shift-drag</b> to pan
          </>
        ) : (
          <>
            Click a table for status · <b className="text-ink">Drag</b> to orbit · <b className="text-ink">Shift-drag</b> to pan · <b className="text-ink">Scroll</b> to zoom
          </>
        )}
      </div>
    </div>
  );
}
