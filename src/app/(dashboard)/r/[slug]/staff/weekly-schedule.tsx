"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Copy, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { POSITION_LABELS, POSITION_COLORS } from "./constants";
import { positionLabel } from "./position-utils";
import { copyWeekScheduleAction } from "./actions";
import { ShiftDialog } from "./shift-dialog";
import type { StaffMember, ShiftData } from "./staff-page-client";
import type { StaffPosition } from "@/generated/prisma/client";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function formatDayHeader(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return d.getUTCDate().toString();
}

function formatMonthYear(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return d.toLocaleDateString([], { month: "long", year: "numeric", timeZone: "UTC" });
}

function formatTime(t: string): string {
  const parts = t.split(":").map(Number);
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12}${ampm}` : `${h12}:${m.toString().padStart(2, "0")}${ampm}`;
}

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().slice(0, 10);
}

export function WeeklySchedule({
  slug,
  members,
  shifts,
  weekStart,
  timezone: _tz,
}: {
  slug: string;
  members: StaffMember[];
  shifts: ShiftData[];
  weekStart: string;
  timezone: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [copying, setCopying] = useState(false);
  const [dialogState, setDialogState] = useState<
    | { mode: "closed" }
    | { mode: "create"; userId: string; date: string; weekDates: string[] }
    | { mode: "edit"; shift: ShiftData }
  >({ mode: "closed" });

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const shiftsByCell = new Map<string, ShiftData[]>();
  for (const s of shifts) {
    const key = `${s.userId}|${s.date}`;
    const arr = shiftsByCell.get(key) ?? [];
    arr.push(s);
    shiftsByCell.set(key, arr);
  }

  function navigateWeek(offset: number) {
    const newWeek = addDays(weekStart, offset * 7);
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("week", newWeek);
    router.push(`/r/${slug}/staff?${sp.toString()}`);
  }

  function goThisWeek() {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("week");
    router.push(`/r/${slug}/staff?${sp.toString()}`);
  }

  async function handleCopyWeek() {
    const target = addDays(weekStart, 7);
    setCopying(true);
    const tid = toast.loading("Copying schedule...");
    const result = await copyWeekScheduleAction(slug, {
      sourceStartDate: weekStart,
      targetStartDate: target,
    });
    setCopying(false);
    if (!result.ok) {
      toast.error(result.error, { id: tid });
    } else {
      toast.success("Schedule copied to next week", { id: tid });
      const sp = new URLSearchParams(searchParams.toString());
      sp.set("week", target);
      router.push(`/r/${slug}/staff?${sp.toString()}`);
      router.refresh();
    }
  }

  const totalShifts = shifts.length;
  const positionCounts = new Map<StaffPosition, number>();
  for (const s of shifts) {
    positionCounts.set(s.position, (positionCounts.get(s.position) ?? 0) + 1);
  }

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon-sm" onClick={() => navigateWeek(-1)} aria-label="Previous week">
            <ChevronLeft className="size-4" />
          </Button>
          <button
            onClick={goThisWeek}
            className="min-w-[160px] text-center text-sm font-semibold hover:text-primary"
          >
            {formatMonthYear(weekStart)}
          </button>
          <Button variant="outline" size="icon-sm" onClick={() => navigateWeek(1)} aria-label="Next week">
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="h-9 gap-2 px-3 text-sm"
            onClick={handleCopyWeek}
            disabled={copying || totalShifts === 0}
          >
            <Copy className="size-3.5" />
            Copy to next week
          </Button>
        </div>
      </div>

      {/* Stats ribbon */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="gap-1.5 px-2.5 py-1 text-xs">
          {totalShifts} shift{totalShifts !== 1 ? "s" : ""} this week
        </Badge>
        {Array.from(positionCounts.entries()).map(([pos, count]) => (
          <Badge
            key={pos}
            variant="outline"
            className="gap-1.5 px-2.5 py-1 text-xs"
          >
            <span className="inline-block size-2 rounded-full" style={{ backgroundColor: POSITION_COLORS[pos] }} />
            {count} {POSITION_LABELS[pos]}
          </Badge>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card ring-1 ring-foreground/5">
        <table className="w-full min-w-[800px] border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-40 border-b border-r border-border bg-muted/50 px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">
                Team Member
              </th>
              {weekDates.map((date, i) => (
                <th
                  key={date}
                  className={`border-b border-border px-2 py-2.5 text-center text-xs font-medium ${
                    isToday(date) ? "bg-primary/5 text-primary" : "text-muted-foreground"
                  } ${i < 6 ? "border-r" : ""}`}
                >
                  <div className="font-medium">{DAY_NAMES[i]}</div>
                  <div className={`mt-0.5 text-lg font-bold ${isToday(date) ? "text-primary" : "text-foreground"}`}>
                    {formatDayHeader(date)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((member, mi) => (
              <tr key={member.id} className={mi % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                <td className="sticky left-0 z-10 border-r border-border bg-inherit px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ backgroundColor: member.position ? POSITION_COLORS[member.position] : "#94a3b8" }}
                    >
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{member.name}</div>
                      {member.position && (
                        <div className="text-[10px] text-muted-foreground">
                          {POSITION_LABELS[member.position]}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                {weekDates.map((date, di) => {
                  const cellShifts = shiftsByCell.get(`${member.id}|${date}`) ?? [];
                  return (
                    <td
                      key={date}
                      className={`group relative border-border px-1 py-1 align-top ${
                        isToday(date) ? "bg-primary/5" : ""
                      } ${di < 6 ? "border-r" : ""} ${mi < members.length - 1 ? "border-b" : ""}`}
                    >
                      <div className="flex min-h-[52px] flex-col gap-1">
                        {cellShifts.map((shift) => (
                          <button
                            key={shift.id}
                            onClick={() => setDialogState({ mode: "edit", shift })}
                            className="w-full rounded-lg px-2 py-1 text-left text-[11px] font-medium text-white transition-all hover:scale-[1.02] hover:shadow-md"
                            style={{ backgroundColor: POSITION_COLORS[shift.position] }}
                          >
                            <div className="font-semibold leading-tight">
                              {formatTime(shift.startTime)}–{formatTime(shift.endTime)}
                            </div>
                            <div className="mt-0.5 text-[10px] leading-tight opacity-90">
                              {positionLabel(shift.position, shift.customPosition)}
                            </div>
                          </button>
                        ))}
                        <button
                          onClick={() => setDialogState({ mode: "create", userId: member.id, date, weekDates })}
                          className="flex w-full items-center justify-center rounded-lg border border-dashed border-transparent py-1 text-[10px] text-muted-foreground/0 transition-all group-hover:border-border group-hover:text-muted-foreground hover:!border-primary hover:!text-primary"
                        >
                          <Plus className="mr-0.5 size-3" />
                          Add
                        </button>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={8} className="py-16 text-center text-sm text-muted-foreground">
                  No active staff. Add team members from Settings first.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Position legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="font-medium">Positions:</span>
        {(Object.keys(POSITION_LABELS) as StaffPosition[]).map((pos) => (
          <span key={pos} className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: POSITION_COLORS[pos] }} />
            {POSITION_LABELS[pos]}
          </span>
        ))}
      </div>

      <ShiftDialog
        slug={slug}
        state={dialogState}
        members={members}
        onClose={() => setDialogState({ mode: "closed" })}
      />
    </div>
  );
}
