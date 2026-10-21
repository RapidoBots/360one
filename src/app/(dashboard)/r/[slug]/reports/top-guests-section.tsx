import Link from "next/link";
import type { TopGuest } from "@/lib/report-metrics";

const AVATAR_PALETTE: [string, string][] = [
  ["#EEF2FF", "#3730A3"],
  ["#FFF4E5", "#B45309"],
  ["#ECFDF3", "#15803D"],
  ["#FDF2F8", "#BE185D"],
  ["#F0F9FF", "#0369A1"],
];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return "?";
  const last = parts.length > 1 ? parts[parts.length - 1] : undefined;
  return ((first[0] ?? "") + (last?.[0] ?? "")).toUpperCase();
}

export function TopGuestsSection({ slug, guests }: { slug: string; guests: TopGuest[] }) {
  const max = Math.max(1, guests[0]?.visits ?? 0);

  return (
    <section className="overflow-hidden rounded-[20px] border border-line-card bg-white shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 px-7 py-6">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-ink">Top repeat guests</h2>
          <p className="mt-0.5 text-[13.5px] text-ink-muted">Guests who visit most often in this range.</p>
        </div>
        <Link href={`/r/${slug}/customers`} className="text-[13.5px] font-semibold text-primary hover:underline">
          View all customers
        </Link>
      </div>
      <div className="border-t border-line-divider">
        {guests.map((g, i) => {
          const [avBg, avColor] = AVATAR_PALETTE[i % AVATAR_PALETTE.length]!;
          return (
            <Link
              key={g.customerId}
              href={`/r/${slug}/customers`}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line-divider px-7 py-3.5 text-ink last:border-b-0 hover:bg-surface-footer"
            >
              <span className="w-6 shrink-0 text-[13px] font-bold text-ink-placeholder">{i + 1}</span>
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-[12.5px] font-extrabold"
                style={{ backgroundColor: avBg, color: avColor }}
              >
                {initialsOf(g.name)}
              </span>
              <span className="min-w-[120px] flex-1 truncate text-[14.5px] font-semibold">{g.name}</span>
              <span className="h-2 min-w-20 flex-1 max-w-[320px] overflow-hidden rounded-full bg-neutral-soft">
                <span className="block h-full rounded-full bg-primary" style={{ width: `${(g.visits / max) * 100}%` }} />
              </span>
              <span className="w-20 shrink-0 text-right text-[13.5px] font-bold">{g.visits} visits</span>
            </Link>
          );
        })}
        {guests.length === 0 && (
          <p className="px-7 py-10 text-center text-sm text-ink-muted">No repeat guests in this range.</p>
        )}
      </div>
    </section>
  );
}
