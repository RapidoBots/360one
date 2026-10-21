"use client";

import { useState } from "react";

export type DayPoint = { dateStr: string; shortLabel: string; longLabel: string; count: number };

const W = 1000;
const H = 260;

export function ReservationsPerDayChart({ points, avgPerDay }: { points: DayPoint[]; avgPerDay: string }) {
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  let peakIndex = 0;
  points.forEach((p, i) => { if (p.count > (points[peakIndex]?.count ?? -1)) peakIndex = i; });
  const foundIndex = points.findIndex((p) => p.dateStr === pickedDate);
  const pickedIndex = foundIndex === -1 ? peakIndex : foundIndex;
  const picked = points[pickedIndex];

  const maxCount = Math.max(1, ...points.map((p) => p.count));
  const step = Math.max(1, Math.ceil(maxCount / 4));
  const top = step * 4;
  const ticks = [0, 1, 2, 3, 4].map((i) => ({ label: String(i * step), pct: i * 25 }));

  const n = points.length;
  const xs = points.map((_, i) => ((i + 0.5) / n) * W);
  const ys = points.map((p) => H - (p.count / top) * H);
  let lineD = n > 0 ? `M${xs[0]!.toFixed(1)} ${ys[0]!.toFixed(1)}` : "";
  for (let i = 1; i < n; i++) {
    const mx = (xs[i - 1]! + xs[i]!) / 2;
    lineD += ` C${mx.toFixed(1)} ${ys[i - 1]!.toFixed(1)} ${mx.toFixed(1)} ${ys[i]!.toFixed(1)} ${xs[i]!.toFixed(1)} ${ys[i]!.toFixed(1)}`;
  }
  const areaD = n > 0 ? `${lineD} L${xs[n - 1]!.toFixed(1)} ${H} L${xs[0]!.toFixed(1)} ${H} Z` : "";
  const labelEvery = Math.max(1, Math.ceil(n / 8));

  const markX = n > 0 ? (xs[pickedIndex]! / W) * 100 : 0;
  const markY = picked ? (picked.count / top) * 100 : 0;

  return (
    <section className="overflow-hidden rounded-[20px] border border-line-card bg-white shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 px-7 py-6">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-ink">Reservations per day</h2>
          <p className="mt-0.5 text-[13.5px] text-ink-muted">
            {picked ? `${picked.longLabel} · ${picked.count} ${picked.count === 1 ? "reservation" : "reservations"}` : ""}
          </p>
        </div>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">Avg {avgPerDay} per day</span>
      </div>
      <div className="border-t border-line-divider p-7">
        <div className="flex gap-2" style={{ height: 300 }}>
          <div className="relative mb-8 w-7 shrink-0" aria-hidden="true">
            {ticks.map((t) => (
              <span key={t.pct} className="absolute right-0 translate-y-1/2 text-xs text-ink-placeholder" style={{ bottom: `${t.pct}%` }}>
                {t.label}
              </span>
            ))}
          </div>
          <div className="relative min-w-0 flex-1">
            <div className="absolute inset-x-0 top-0 bottom-8" aria-hidden="true">
              {ticks.map((t) => (
                <div key={t.pct} className="absolute inset-x-0 border-t border-dashed border-line-card" style={{ bottom: `${t.pct}%` }} />
              ))}
              <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute left-0 top-0 size-full overflow-visible">
                <defs>
                  <linearGradient id="reportsAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={areaD} fill="url(#reportsAreaGradient)" stroke="none" />
                <path d={lineD} fill="none" stroke="var(--primary)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              </svg>
              {picked && (
                <span
                  className="absolute size-3 -ml-1.5 -mb-1.5 rounded-full border-[3px] border-primary bg-white shadow-[0_2px_6px_rgba(15,23,42,0.2)]"
                  style={{ left: `${markX}%`, bottom: `${markY}%` }}
                />
              )}
            </div>
            <div className="absolute inset-x-0 top-0 bottom-8 flex">
              {points.map((p) => {
                const on = p.dateStr === picked?.dateStr;
                return (
                  <button
                    key={p.dateStr}
                    type="button"
                    onClick={() => setPickedDate(p.dateStr)}
                    aria-pressed={on}
                    aria-label={`${p.longLabel}: ${p.count} ${p.count === 1 ? "reservation" : "reservations"}`}
                    className="h-full min-w-0 flex-1 border-0 p-0"
                    style={{ backgroundColor: on ? "color-mix(in srgb, var(--primary) 6%, transparent)" : "transparent" }}
                  />
                );
              })}
            </div>
            <div className="absolute inset-x-0 bottom-0 flex h-8" aria-hidden="true">
              {points.map((p, i) => (
                <span key={p.dateStr} className="flex min-w-0 flex-1 items-center justify-center text-xs whitespace-nowrap text-ink-muted">
                  {i % labelEvery === 0 ? p.shortLabel : ""}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
