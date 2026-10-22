"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { FURNITURE_CATALOG, type FurnitureCatalogItem, type FurnitureCategory } from "./furniture-catalog";

const CATEGORIES: FurnitureCategory[] = ["Bar", "Seating", "Structure", "Decor"];

export function FurnitureLibrary({ onPlace }: { onPlace: (item: FurnitureCatalogItem) => void }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<FurnitureCategory | null>(null);

  const items = useMemo(
    () =>
      FURNITURE_CATALOG.filter(
        (c) =>
          (!category || c.category === category) &&
          (!query.trim() || c.name.toLowerCase().includes(query.trim().toLowerCase()))
      ),
    [query, category]
  );

  return (
    <aside className="flex w-[280px] shrink-0 flex-col overflow-hidden rounded-[20px] border border-line-card bg-white shadow-card">
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
          {items.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onPlace(c)}
              className="flex flex-col items-center gap-1.5 rounded-xl border border-line-input bg-white p-2.5 text-center hover:bg-surface-footer"
            >
              <span className="size-7 rounded-md" style={{ backgroundColor: c.color }} />
              <span className="text-[11.5px] font-semibold leading-tight text-ink">{c.name}</span>
            </button>
          ))}
          {items.length === 0 && <p className="col-span-2 py-6 text-center text-[12.5px] text-ink-muted">No matches.</p>}
        </div>
      </div>
    </aside>
  );
}
