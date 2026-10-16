"use client";

import { useState } from "react";
import { Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionCard, FieldLabel } from "@/components/ui/section-card";
import { getHoursForDay, type DayHours } from "@/lib/business-hours";
import { updateBusinessSettingsAction, type BusinessHoursInput } from "./actions";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const fieldClass =
  "h-11 w-full rounded-xl border-line-input bg-white px-3.5 text-sm font-medium text-ink focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/16";

function minutesToTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function toRow(businessHours: DayHours[], dayOfWeek: number): BusinessHoursInput {
  const { isOpen, startMinutes, endMinutes } = getHoursForDay(businessHours, dayOfWeek);
  return {
    dayOfWeek,
    isOpen,
    openTime: isOpen ? minutesToTime(startMinutes) : null,
    closeTime: isOpen ? minutesToTime(endMinutes) : null,
  };
}

export function BusinessHoursForm({
  slug,
  businessHours,
  defaultReservationDurationMinutes,
}: {
  slug: string;
  businessHours: DayHours[];
  defaultReservationDurationMinutes: number;
}) {
  const [rows, setRows] = useState<BusinessHoursInput[]>(
    Array.from({ length: 7 }, (_, dayOfWeek) => toRow(businessHours, dayOfWeek))
  );
  const [duration, setDuration] = useState(defaultReservationDurationMinutes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function updateRow(dayOfWeek: number, patch: Partial<BusinessHoursInput>) {
    setRows((prev) => prev.map((r) => (r.dayOfWeek === dayOfWeek ? { ...r, ...patch } : r)));
    setSaved(false);
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    const result = await updateBusinessSettingsAction(slug, {
      hours: rows,
      defaultReservationDurationMinutes: duration,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved(true);
  }

  return (
    <SectionCard
      id="hours"
      icon={Clock}
      title="Business hours and reservation rules"
      description="Set when guests can book. A closing time earlier than the opening time runs past midnight."
      footer={
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="h-11 rounded-xl bg-primary px-5.5 text-sm font-bold text-primary-foreground shadow-[0_6px_16px_-6px_var(--primary)] hover:bg-primary"
        >
          {saving ? <><Loader2 className="mr-2 size-4 animate-spin" />Saving...</> : saved ? "Saved" : "Save business settings"}
        </Button>
      }
    >
      <div className="px-7">
        {rows.map((row) => (
          <div
            key={row.dayOfWeek}
            className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-line-divider py-3.5 last:border-b-0"
          >
            <div className="min-w-[110px] flex-1 text-sm font-semibold text-ink">{DAY_NAMES[row.dayOfWeek]}</div>
            <div className="flex min-w-[130px] flex-1 items-center gap-2.5">
              <button
                type="button"
                role="switch"
                aria-checked={row.isOpen}
                aria-label={`${DAY_NAMES[row.dayOfWeek]} open`}
                onClick={() =>
                  updateRow(row.dayOfWeek, {
                    isOpen: !row.isOpen,
                    openTime: !row.isOpen ? (row.openTime ?? "07:00") : null,
                    closeTime: !row.isOpen ? (row.closeTime ?? "23:00") : null,
                  })
                }
                className="flex h-[26px] w-11 shrink-0 cursor-pointer items-center rounded-full border-0 p-[3px] transition-colors"
                style={{
                  justifyContent: row.isOpen ? "flex-end" : "flex-start",
                  backgroundColor: row.isOpen ? "var(--primary)" : "#CBD5E1",
                }}
              >
                <span className="size-5 rounded-full bg-white shadow-[0_1px_3px_rgba(15,23,42,.3)]" />
              </button>
              <span className={`text-[13px] font-semibold ${row.isOpen ? "text-success" : "text-ink-muted"}`}>
                {row.isOpen ? "Open" : "Closed"}
              </span>
            </div>
            <div className="flex min-w-[300px] flex-[2] items-center gap-2.5" style={{ opacity: row.isOpen ? 1 : 0.5 }}>
              <Input
                type="time"
                aria-label={`${DAY_NAMES[row.dayOfWeek]} opening time`}
                value={row.openTime ?? "07:00"}
                disabled={!row.isOpen}
                onChange={(e) => updateRow(row.dayOfWeek, { openTime: e.target.value })}
                className={`${fieldClass} min-w-[120px] flex-1`}
              />
              <span className="text-[13px] text-ink-muted">to</span>
              <Input
                type="time"
                aria-label={`${DAY_NAMES[row.dayOfWeek]} closing time`}
                value={row.closeTime ?? "23:00"}
                disabled={!row.isOpen}
                onChange={(e) => updateRow(row.dayOfWeek, { closeTime: e.target.value })}
                className={`${fieldClass} min-w-[120px] flex-1`}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="px-7 pt-5 pb-7">
        <label className="flex max-w-[260px] flex-col gap-2">
          <FieldLabel>Default reservation duration</FieldLabel>
          <div className="relative flex items-center">
            <Input
              type="number"
              min={15}
              step={15}
              value={duration}
              onChange={(e) => {
                setDuration(Number(e.target.value));
                setSaved(false);
              }}
              className={`${fieldClass} pr-[60px]`}
            />
            <span className="pointer-events-none absolute right-3.5 text-[13px] text-ink-muted">minutes</span>
          </div>
        </label>
      </div>

      {error && <p className="px-7 pb-5 text-sm text-destructive">{error}</p>}
    </SectionCard>
  );
}
