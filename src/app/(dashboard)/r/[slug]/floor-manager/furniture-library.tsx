"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { FURNITURE_CATALOG, TABLE_CATALOG, type FurnitureCatalogItem, type TableCatalogItem, type FurnitureCategory } from "./furniture-catalog";
import { getFurnitureThumbnail, getTableThumbnail } from "./furniture-thumbnail";

const CATEGORIES: FurnitureCategory[] = ["Tables", "Bar", "Seating", "Structure", "Decor"];

type CatalogEntry = { key: string; name: string; category: FurnitureCategory; place: () => void; thumb: () => string };

export function FurnitureLibrary({
  onPlace,
  onPlaceTable,
}: {
  onPlace: (item: FurnitureCatalogItem) => void;
  onPlaceTable: (item: TableCatalogItem) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<FurnitureCategory | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  const entries: CatalogEntry[] = useMemo(
    () => [
      ...TABLE_CATALOG.map((item): CatalogEntry => ({
        key: `table:${item.id}`,
        name: item.name,
        category: item.category,
        place: () => onPlaceTable(item),
        thumb: () => getTableThumbnail(item),
      })),
      ...FURNITURE_CATALOG.map((item): CatalogEntry => ({
        key: `item:${item.id}`,
        name: item.name,
        category: item.category,
        place: () => onPlace(item),
        thumb: () => getFurnitureThumbnail(item),
      })),
    ],
    [onPlace, onPlaceTable]
  );

  // Pre-render every thumbnail once on mount -- results are cached in
  // furniture-thumbnail.ts, so this is the only time the WebGL cost is paid.
  useEffect(() => {
    const next: Record<string, string> = {};
    for (const e of entries) next[e.key] = e.thumb();
    setThumbs(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(
    () =>
      entries.filter(
        (e) =>
          (!category || e.category === category) &&
          (!query.trim() || e.name.toLowerCase().includes(query.trim().toLowerCase()))
      ),
    [entries, query, category]
  );

  return (
    <aside className="flex h-full w-[280px] shrink-0 flex-col overflow-hidden rounded-[20px] border border-line-card bg-white shadow-card">
      <div className="border-b border-line-divider p-4">
        <div className="text-sm font-bold text-ink">Furniture</div>
        <div className="relative mt-2.5">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            placeholder="Search furniture..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 w-full rounded-lg border border-line-input bg-white pl-8 pr-3 text-[13px] font-medium text-ink focus-visible:border-primary focus-visible:outline-none"
          />
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setCategory(null)}
            className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${!category ? "bg-primary text-white" : "bg-surface-footer text-ink-muted hover:text-ink"}`}
          >
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${category === c ? "bg-primary text-white" : "bg-surface-footer text-ink-muted hover:text-ink"}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <p className="px-1 pb-2 text-[12px] text-ink-muted">Click a piece to drop it onto the floor, then drag it into place.</p>
        <div className="grid grid-cols-2 gap-2">
          {filtered.map((e) => (
            <button
              key={e.key}
              type="button"
              onClick={e.place}
              className="flex flex-col items-center gap-1.5 rounded-xl border border-line-input bg-white p-2 text-center hover:bg-surface-footer"
            >
              <span className="flex size-16 items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element -- small rendered data URL, not an optimizable asset */}
                {thumbs[e.key] ? <img src={thumbs[e.key]} alt="" className="size-16 object-contain" /> : <span className="size-7 rounded-md bg-neutral-soft" />}
              </span>
              <span className="text-[11.5px] font-semibold leading-tight text-ink">{e.name}</span>
            </button>
          ))}
          {filtered.length === 0 && <p className="col-span-2 py-6 text-center text-[12.5px] text-ink-muted">No matches.</p>}
        </div>
      </div>
    </aside>
  );
}
