"use client";

import { useState } from "react";

export type PeakBarItem = { label: string; longLabel: string; count: number };

// Shared by "Busiest day of the week" and "Busiest hour of the day" -- same
// peak-highlighted, click-to-pick bar chart, just different data and bar width.
export function PeakBarChart({
  title,
  items,
  barWidth,
  gap,
}: {
  title: string;
  items: PeakBarItem[];
  barWidth: number;
  gap: number;
}) {
  let peak = items[0];
  for (const it of items) {
    if (it.count > (peak?.count ?? -1)) peak = it;
  }
  const [pickedLabel, setPickedLabel] = useState<string | null>(null);
  const picked = items.find((it) => it.label === pickedLabel) ?? peak;
  const max = Math.max(1, ...items.map((it) => it.count));

  return (
    <section className="min-w-0 flex-[1_1_420px] overflow-hidden rounded-[20px] border border-line-card bg-white shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 px-7 py-6">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-ink">{title}</h2>
          <p className="mt-0.5 text-[13.5px] text-ink-muted">
            {picked ? `${picked.longLabel} · ${picked.count} ${picked.count === 1 ? "reservation" : "reservations"}` : ""}
          </p>
        </div>
        {peak && (
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">Peak {peak.longLabel}</span>
        )}
      </div>
      <div className="border-t border-line-divider p-7">
        <div className="flex border-b border-line-card" style={{ height: 240, gap }}>
          {items.map((it) => {
            const on = it.label === picked?.label;
            return (
              <button
                key={it.label}
                type="button"
                onClick={() => setPickedLabel(it.label)}
                aria-pressed={on}
                aria-label={`${it.longLabel}: ${it.count} ${it.count === 1 ? "reservation" : "reservations"}`}
                className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1 rounded-t-[10px] border-0 p-0 transition-colors hover:bg-[#0F172A]/[0.03]"
                style={{ backgroundColor: on ? "color-mix(in srgb, var(--primary) 6%, transparent)" : undefined }}
              >
                <span className="text-xs font-bold text-ink">{it.count}</span>
                <span
                  className="block rounded-t-lg"
                  style={{
                    width: `min(${barWidth}px, 70%)`,
                    height: `${(it.count / max) * 100}%`,
                    minHeight: 3,
                    backgroundColor: on ? "var(--primary)" : "color-mix(in srgb, var(--primary) 55%, transparent)",
                  }}
                />
              </button>
            );
          })}
        </div>
        <div className="flex pt-2.5" style={{ gap }} aria-hidden="true">
          {items.map((it) => {
            const on = it.label === picked?.label;
            return (
              <span
                key={it.label}
                className={`min-w-0 flex-1 text-center text-[12.5px] ${on ? "font-bold text-primary" : "font-medium text-ink-muted"}`}
              >
                {it.label}
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}
