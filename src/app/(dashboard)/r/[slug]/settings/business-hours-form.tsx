"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getHoursForDay, type DayHours } from "@/lib/business-hours";
import { updateBusinessSettingsAction, type BusinessHoursInput } from "./actions";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
    <form onSubmit={handleSubmit} className="space-y-4 rounded-[5px] border border-border p-5">
      <h2 className="text-base font-semibold">Business hours & reservation rules</h2>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.dayOfWeek} className="grid grid-cols-[7rem_7rem_1fr_1fr] items-center gap-3">
            <span className="text-base font-medium">{DAY_NAMES[row.dayOfWeek]}</span>
            <Select
              value={row.isOpen ? "open" : "closed"}
              onValueChange={(v) =>
                updateRow(row.dayOfWeek, {
                  isOpen: v === "open",
                  openTime: v === "open" ? (row.openTime ?? "07:00") : null,
                  closeTime: v === "open" ? (row.closeTime ?? "23:00") : null,
                })
              }
            >
              <SelectTrigger className="h-10 w-full text-base" aria-label={`${DAY_NAMES[row.dayOfWeek]} status`}>
                <SelectValue>{(value: string) => (value === "open" ? "Open" : "Closed")}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="time"
              className="h-10 w-full text-base"
              aria-label={`${DAY_NAMES[row.dayOfWeek]} opens`}
              value={row.openTime ?? "07:00"}
              onChange={(e) => updateRow(row.dayOfWeek, { openTime: e.target.value })}
              disabled={!row.isOpen}
            />
            <Input
              type="time"
              className="h-10 w-full text-base"
              aria-label={`${DAY_NAMES[row.dayOfWeek]} closes`}
              value={row.closeTime ?? "23:00"}
              onChange={(e) => updateRow(row.dayOfWeek, { closeTime: e.target.value })}
              disabled={!row.isOpen}
            />
          </div>
        ))}
      </div>
      <div className="max-w-xs space-y-2">
        <Label htmlFor="defaultDuration">Default reservation duration (minutes)</Label>
        <Input
          id="defaultDuration"
          type="number"
          min={15}
          step={15}
          className="h-11 text-base"
          value={duration}
          onChange={(e) => {
            setDuration(Number(e.target.value));
            setSaved(false);
          }}
          required
        />
      </div>
      {error && <p className="text-base text-destructive">{error}</p>}
      <Button type="submit" className="h-11 px-5 text-base" disabled={saving}>
        {saving ? "Saving..." : saved ? "Saved" : "Save business settings"}
      </Button>
    </form>
  );
}
