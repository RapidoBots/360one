import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { STATUS_COLORS } from "../reservations/reservation-badge";

export type WeekTile = { label: string; count: number; hint: string; href: string; dot: string; color: string; amber?: boolean };
export type WeekDaySummary = {
  dow: string;
  num: number;
  total: number;
  isToday: boolean;
  segments: { pct: number; color: string }[];
  note: string;
  noteIsWarning: boolean;
  href: string;
};

const LEGEND: { label: string; color: string }[] = [
  { label: "Confirmed", color: STATUS_COLORS.CONFIRMED.bar },
  { label: "Seated", color: STATUS_COLORS.SEATED.bar },
  { label: "Completed", color: STATUS_COLORS.COMPLETED.bar },
  { label: "Pending", color: STATUS_COLORS.PENDING.bar },
];

export function ThisWeekSection({
  weekRangeLabel,
  weekTotal,
  weekLink,
  tiles,
  days,
}: {
  weekRangeLabel: string;
  weekTotal: number;
  weekLink: string;
  tiles: WeekTile[];
  days: WeekDaySummary[];
}) {
  return (
    <section className="overflow-hidden rounded-[20px] border border-line-card bg-white shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 px-7 py-6">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-ink">This week</h2>
          <p className="mt-0.5 text-[13.5px] text-ink-muted">
            {weekRangeLabel} · {weekTotal} reservations
          </p>
        </div>
        <Link
          href={weekLink}
          className="flex h-10 items-center gap-2 rounded-xl border border-[#D5DAEA] bg-white px-3.5 text-[13.5px] font-semibold text-ink hover:bg-[#F8F9FD]"
        >
          Open week view
          <ArrowUpRight className="size-4" />
        </Link>
      </div>
      <div className="flex flex-col gap-6 border-t border-line-divider p-7">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
          {tiles.map((t) => (
            <Link
              key={t.label}
              href={t.href}
              aria-label={`${t.label}: ${t.count}. Open in reservations.`}
              className={`flex flex-col gap-1.5 rounded-2xl border border-line-card px-5 py-4 transition-colors hover:border-[#C7D0EA] hover:shadow-[0_8px_20px_-12px_rgba(15,23,42,0.18)] ${
                t.amber ? "bg-warning-soft" : "bg-white"
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: t.color }}>
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: t.dot }} />
                  {t.label}
                </span>
                <ArrowUpRight className="size-4 text-ink-placeholder" />
              </span>
              <span className="text-[30px] font-extrabold leading-tight tracking-tight text-ink">{t.count}</span>
              <span className="text-[12.5px] text-ink-muted">{t.hint}</span>
            </Link>
          ))}
        </div>

        <div>
          <div className="mb-3 text-xs font-bold tracking-wider text-ink-muted uppercase">Day by day</div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3">
            {days.map((d) => (
              <Link
                key={d.href}
                href={d.href}
                aria-label={`${d.dow} ${d.num}: ${d.total} reservations. Open day view.`}
                className="flex flex-col gap-2.5 rounded-2xl border px-4 py-3.5 transition-colors hover:border-[#C7D0EA] hover:shadow-[0_8px_20px_-12px_rgba(15,23,42,0.18)]"
                style={{
                  borderColor: d.isToday ? "var(--primary)" : "var(--line-card)",
                  backgroundColor: d.isToday ? "color-mix(in srgb, var(--primary) 5%, white)" : "white",
                }}
              >
                <span className="flex items-center justify-between gap-2">
                  <span
                    className="text-xs font-bold tracking-wider uppercase"
                    style={{ color: d.isToday ? "var(--primary)" : "var(--ink-muted)" }}
                  >
                    {d.dow} {d.num}
                  </span>
                  {d.isToday && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
                      Today
                    </span>
                  )}
                </span>
                <span className="text-[22px] font-extrabold leading-none tracking-tight text-ink">{d.total}</span>
                <span className="flex h-1.5 overflow-hidden rounded-full bg-neutral-soft">
                  {d.segments.map((s, i) => (
                    <span key={i} style={{ width: `${s.pct}%`, backgroundColor: s.color }} />
                  ))}
                </span>
                <span className={`text-xs font-semibold ${d.noteIsWarning ? "text-warning" : "text-ink-muted"}`}>
                  {d.note}
                </span>
              </Link>
            ))}
          </div>
          <div className="mt-3.5 flex flex-wrap gap-x-4 gap-y-1.5">
            {LEGEND.map((l) => (
              <span key={l.label} className="inline-flex items-center gap-1.5 text-[12.5px] text-[#475569]">
                <span className="size-2 rounded-full" style={{ backgroundColor: l.color }} />
                {l.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
