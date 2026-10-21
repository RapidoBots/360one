"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const PRESETS: { label: string; days: number }[] = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
];

export function DateRangeControl({ start, end, today }: { start: string; end: string; today: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [draftStart, setDraftStart] = useState(start);
  const [draftEnd, setDraftEnd] = useState(end);

  function apply(nextStart: string, nextEnd: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("start", nextStart);
    params.set("end", nextEnd);
    router.push(`${pathname}?${params.toString()}`);
  }

  const isPreset = (days: number) => end === today && start === addDays(today, -(days - 1));
  const noPresetMatches = !PRESETS.some((p) => isPreset(p.days));

  const badDraft = !draftStart || !draftEnd;
  const same = draftStart === start && draftEnd === end;
  const cantApply = badDraft || same;

  return (
    <section
      aria-label="Date range"
      className="flex flex-wrap items-end gap-x-6 gap-y-4 rounded-[20px] border border-line-card bg-white p-6 shadow-card"
    >
      <div role="group" aria-label="Quick ranges" className="flex gap-0.5 rounded-xl bg-[#E9ECF5] p-1">
        {PRESETS.map((p) => {
          const on = isPreset(p.days);
          return (
            <button
              key={p.label}
              type="button"
              aria-pressed={on}
              onClick={() => {
                const nextStart = addDays(today, -(p.days - 1));
                setDraftStart(nextStart);
                setDraftEnd(today);
                apply(nextStart, today);
              }}
              className={`h-9 rounded-[9px] px-3.5 text-[13.5px] transition-colors ${
                on ? "bg-white font-bold text-ink shadow-sm" : "font-semibold text-[#475569]"
              }`}
            >
              {p.label}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={noPresetMatches}
          className={`h-9 rounded-[9px] px-3.5 text-[13.5px] ${
            noPresetMatches ? "bg-white font-bold text-ink shadow-sm" : "font-semibold text-[#475569]"
          }`}
        >
          Custom
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-ink">Start</span>
          <Input
            type="date"
            value={draftStart}
            onChange={(e) => setDraftStart(e.target.value)}
            className="h-11 w-[160px] text-sm"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-ink">End</span>
          <Input
            type="date"
            value={draftEnd}
            onChange={(e) => setDraftEnd(e.target.value)}
            className="h-11 w-[160px] text-sm"
          />
        </label>
        <Button
          type="button"
          disabled={cantApply}
          onClick={() => apply(draftStart, draftEnd)}
          className="h-11 rounded-xl px-5.5 text-sm font-bold shadow-[0_6px_16px_-6px_var(--primary)]"
        >
          Apply range
        </Button>
      </div>
    </section>
  );
}
