"use client";

import { useState } from "react";

export type HourBucket = {
  hour: number;
  label: string;
  longLabel: string;
  count: number;
  names: string[];
};

export function ReservationsByHourChart({ buckets, nowHour }: { buckets: HourBucket[]; nowHour: number }) {
  const maxCount = Math.max(0, ...buckets.map((b) => b.count));
  const step = Math.max(1, Math.ceil(Math.max(maxCount, 4) / 4));
  const top = step * 4;
  const ticks = [0, 1, 2, 3, 4].map((i) => ({ label: String(i * step), pct: i * 25 }));

  let peak = buckets[0];
  for (const b of buckets) {
    if (b.count > (peak?.count ?? -1)) peak = b;
  }

  const [pickedHour, setPickedHour] = useState<number | null>(null);
  const picked = buckets.find((b) => b.hour === pickedHour) ?? peak;

  const pickText = !picked
    ? ""
    : picked.count > 0
    ? `${picked.longLabel} · ${picked.count} ${picked.count === 1 ? "reservation" : "reservations"}: ${picked.names.join(", ")}`
    : `${picked.longLabel} · no reservations`;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-ink">Reservations by hour</h2>
          <p className="mt-0.5 text-[13.5px] text-ink-muted">{pickText}</p>
        </div>
        {peak && (
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
            Peak {peak.longLabel}
          </span>
        )}
      </div>
      <div className="mt-6 flex gap-2" style={{ height: 280 }}>
        <div className="relative mb-8 w-6 shrink-0" aria-hidden="true">
          {ticks.map((t) => (
            <span
              key={t.pct}
              className="absolute right-0 translate-y-1/2 text-xs text-ink-placeholder"
              style={{ bottom: `${t.pct}%` }}
            >
              {t.label}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="absolute inset-x-0 top-0 bottom-8" aria-hidden="true">
            {ticks.map((t) => (
              <div
                key={t.pct}
                className="absolute inset-x-0 border-t border-dashed border-line-card"
                style={{ bottom: `${t.pct}%` }}
              />
            ))}
          </div>
          <div className="absolute inset-0 flex gap-1">
            {buckets.map((b) => {
              const on = b.hour === picked?.hour;
              const h = top === 0 ? 0 : (b.count / top) * 100;
              return (
                <button
                  key={b.hour}
                  type="button"
                  onClick={() => setPickedHour(b.hour)}
                  aria-pressed={on}
                  aria-label={`${b.longLabel}: ${b.count} ${b.count === 1 ? "reservation" : "reservations"}${b.hour === nowHour ? " (current hour)" : ""}`}
                  className="flex min-w-0 flex-1 flex-col rounded-[10px] border-0 bg-transparent p-0 transition-colors hover:bg-[#0F172A]/[0.03]"
                  style={{ backgroundColor: on ? "color-mix(in srgb, var(--primary) 6%, transparent)" : undefined }}
                >
                  <span className="flex flex-1 w-full flex-col items-center justify-end gap-1">
                    <span className={`text-xs font-bold text-ink ${b.count > 0 ? "visible" : "invisible"}`}>
                      {b.count}
                    </span>
                    <span
                      className="block w-[min(56px,70%)] rounded-t-lg"
                      style={{
                        height: `${h}%`,
                        minHeight: b.count > 0 ? 4 : 0,
                        backgroundColor: on ? "var(--primary)" : "color-mix(in srgb, var(--primary) 55%, transparent)",
                      }}
                    />
                  </span>
                  <span
                    className={`flex h-8 shrink-0 items-center justify-center text-[12.5px] ${
                      b.hour === nowHour ? "font-extrabold text-primary" : "font-medium text-ink-muted"
                    }`}
                  >
                    {b.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
