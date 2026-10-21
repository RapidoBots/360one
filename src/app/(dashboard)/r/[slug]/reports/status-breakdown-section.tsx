import Link from "next/link";
import { STATUS_COLORS, STATUS_LABELS, STATUS_URL_TOKEN } from "../reservations/reservation-badge";
import type { ReservationStatus } from "@/generated/prisma/client";

const STATUS_ORDER: ReservationStatus[] = ["PENDING", "CONFIRMED", "SEATED", "COMPLETED", "CANCELLED", "NO_SHOW"];

export function StatusBreakdownSection({
  slug,
  counts,
}: {
  slug: string;
  counts: Record<ReservationStatus, number>;
}) {
  const total = STATUS_ORDER.reduce((sum, s) => sum + counts[s], 0);
  const rows = STATUS_ORDER.map((status) => ({
    status,
    n: counts[status],
    pct: total ? (counts[status] / total) * 100 : 0,
  }));
  const ariaLabel = rows.map((r) => `${r.n} ${STATUS_LABELS[r.status]}`).join(", ");

  return (
    <section className="min-w-0 flex-[1_1_420px] overflow-hidden rounded-[20px] border border-line-card bg-white shadow-card">
      <div className="px-7 py-6">
        <h2 className="text-lg font-bold tracking-tight text-ink">Status breakdown</h2>
        <p className="mt-0.5 text-[13.5px] text-ink-muted">Select a status to open those reservations.</p>
      </div>
      <div className="flex flex-col gap-5 border-t border-line-divider p-7">
        <div className="flex h-3.5 overflow-hidden rounded-full bg-neutral-soft" role="img" aria-label={ariaLabel}>
          {rows.filter((r) => r.pct > 0).map((r) => (
            <span key={r.status} style={{ width: `${r.pct}%`, backgroundColor: STATUS_COLORS[r.status].bar }} />
          ))}
        </div>
        <div className="flex flex-col">
          {rows.map((r) => (
            <Link
              key={r.status}
              href={`/r/${slug}/reservations?view=week&status=${STATUS_URL_TOKEN[r.status]}`}
              className="-mx-2.5 flex items-center gap-3 rounded-[10px] border-b border-line-divider px-2.5 py-3 text-ink last:border-b-0 hover:bg-surface-footer"
            >
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: STATUS_COLORS[r.status].bar }} />
              <span className="flex-1 text-sm font-semibold">{STATUS_LABELS[r.status]}</span>
              <span className="text-sm font-bold">{r.n}</span>
              <span className="w-[52px] text-right text-[13px] text-ink-muted">{Math.round(r.pct)}%</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
