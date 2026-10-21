"use client";

import { useState } from "react";

export type TableCount = { name: string; count: number };

export function PerTableSection({ tables }: { tables: TableCount[] }) {
  const [showAll, setShowAll] = useState(false);
  const ranked = [...tables].sort((a, b) => b.count - a.count);
  const shown = showAll ? ranked : ranked.slice(0, 10);
  const max = Math.max(1, ranked[0]?.count ?? 0);

  return (
    <section className="min-w-0 flex-[1_1_420px] overflow-hidden rounded-[20px] border border-line-card bg-white shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 px-7 py-6">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-ink">Reservations per table</h2>
          <p className="mt-0.5 text-[13.5px] text-ink-muted">
            Top {shown.length} of {ranked.length} tables
          </p>
        </div>
        {ranked.length > 10 && (
          <button
            type="button"
            aria-expanded={showAll}
            onClick={() => setShowAll((v) => !v)}
            className="flex h-10 items-center rounded-xl border border-[#D5DAEA] bg-white px-3.5 text-[13.5px] font-semibold text-ink hover:bg-[#F8F9FD]"
          >
            {showAll ? "Show top 10" : `Show all ${ranked.length}`}
          </button>
        )}
      </div>
      <div
        className="flex flex-col gap-2 overflow-y-auto border-t border-line-divider px-7 py-3"
        style={{ maxHeight: showAll ? 420 : 520 }}
      >
        {shown.map((t, i) => (
          <div key={t.name} className="flex items-center gap-3 py-1">
            <span className="w-[70px] shrink-0 truncate text-[13.5px] font-semibold text-[#334155]">{t.name}</span>
            <span className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-neutral-soft">
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${(t.count / max) * 100}%`,
                  backgroundColor: i === 0 ? "var(--primary)" : "color-mix(in srgb, var(--primary) 55%, transparent)",
                }}
              />
            </span>
            <span className="w-7 shrink-0 text-right text-[13.5px] font-bold text-ink">{t.count}</span>
          </div>
        ))}
        {ranked.length === 0 && <p className="py-6 text-center text-sm text-ink-muted">No tables yet.</p>}
      </div>
    </section>
  );
}
