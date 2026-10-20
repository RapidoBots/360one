"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Copy, Plus, Check, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { SHIFT_STYLES } from "./constants";
import { positionLabel } from "./position-utils";
import { copyWeekScheduleAction, publishWeekAction } from "./actions";
import { ShiftDialog } from "./shift-dialog";
import type { StaffMember, ShiftData } from "./staff-page-client";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
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
  isOwner,
  swapTagByShiftId = {},
}: {
  slug: string;
  members: StaffMember[];
  shifts: ShiftData[];
  weekStart: string;
  timezone: string;
  isOwner: boolean;
  swapTagByShiftId?: Record<string, string>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [copying, setCopying] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [dialogState, setDialogState] = useState<
    | { mode: "closed" }
    | { mode: "create"; userId: string; date: string; weekDates: string[] }
    | { mode: "edit"; shift: ShiftData }
  >({ mode: "closed" });

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hasDrafts = shifts.some((s) => s.draft);

  const filteredMembers = members.filter((m) => {
    if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (roleFilter !== "all" && m.position !== roleFilter) return false;
    return true;
  });

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

  async function handlePublish() {
    if (!hasDrafts) {
      toast.info("No draft shifts to publish this week.");
      return;
    }
    setPublishing(true);
    const tid = toast.loading("Publishing schedule...");
    const result = await publishWeekAction(slug, weekStart);
    setPublishing(false);
    if (!result.ok) {
      toast.error(result.error, { id: tid });
    } else {
      toast.success("Schedule published — your team can now see it.", { id: tid });
      router.refresh();
    }
  }

  function weekLabel(): string {
    const start = new Date(weekStart + "T12:00:00Z");
    const end = new Date(addDays(weekStart, 6) + "T12:00:00Z");
    const s = start.toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "UTC" });
    const e = end.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
    return `${s} – ${e}`;
  }

  function memberHours(memberId: string): number {
    return shifts
      .filter((s) => s.userId === memberId)
      .reduce((sum, s) => {
        const [sh, sm] = s.startTime.split(":").map(Number);
        const [eh, em] = s.endTime.split(":").map(Number);
        let mins = (eh! * 60 + em!) - (sh! * 60 + sm!);
        if (mins <= 0) mins += 1440;
        return sum + mins / 60;
      }, 0);
  }

  return (
    <div className="space-y-4">
      {/* Panel */}
      <div className="overflow-hidden rounded-[20px] border border-line-card bg-white shadow-card">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-divider px-5 py-4">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-ink">{weekLabel()}</h3>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon-sm" onClick={() => navigateWeek(-1)} aria-label="Previous week">
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="outline" size="icon-sm" onClick={() => navigateWeek(1)} aria-label="Next week">
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <Button variant="outline" size="sm" className="text-xs" onClick={goThisWeek}>
              This week
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {isOwner && (
              <>
                <Button
                  variant="outline" size="sm" className="gap-1.5 text-xs"
                  onClick={handleCopyWeek} disabled={copying || shifts.length === 0}
                >
                  <Copy className="size-3.5" />
                  Copy last week
                </Button>
                <Button
                  size="sm" className="gap-1.5 text-xs"
                  onClick={handlePublish} disabled={publishing || !hasDrafts}
                >
                  <Check className="size-3.5" />
                  Publish week
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-divider px-5 py-3">
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Search team members..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-[200px] rounded-lg border-line-input bg-white px-3 text-xs font-medium text-ink placeholder:text-ink-placeholder focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/16"
            />
            <NativeSelect
              compact
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-[140px] text-xs"
            >
              <option value="all">All roles</option>
              <option value="SERVER">Server</option>
              <option value="HOST">Host</option>
              <option value="CHEF">Chef</option>
              <option value="BARTENDER">Bartender</option>
              <option value="MANAGER">Manager</option>
              <option value="OTHER">Other</option>
            </NativeSelect>
          </div>
          <div className="flex items-center gap-3 text-xs text-ink-muted">
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-2 rounded-sm" style={{ background: "#2855ee" }} />
              Service
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-2 rounded-sm" style={{ background: "#222d47" }} />
              Kitchen
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-2 rounded-sm" style={{ background: "#8296bf" }} />
              Host
            </span>
          </div>
        </div>

        {/* Grid */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr>
                <th className="w-[180px] border-b border-r border-line-divider bg-surface-footer px-5 py-3 text-left text-[11px] font-bold tracking-wider text-ink-muted uppercase">
                  Team member <span className="ml-1 normal-case text-ink-muted/70">{filteredMembers.length} people</span>
                </th>
                {weekDates.map((date, i) => (
                  <th
                    key={date}
                    className={`border-b border-line-divider px-2 py-3 text-center text-[11px] font-bold tracking-wider text-ink-muted uppercase ${
                      i < 6 ? "border-r" : ""
                    } ${isToday(date) ? "bg-primary/5" : "bg-surface-footer"}`}
                  >
                    {DAY_NAMES[i]?.toUpperCase()}
                    <br />
                    <span className={`mt-1 inline-flex size-7 items-center justify-center text-base font-semibold ${
                      isToday(date)
                        ? "rounded-full bg-primary text-primary-foreground"
                        : "text-foreground"
                    }`}>
                      {new Date(date + "T12:00:00Z").getUTCDate()}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((member) => (
                <tr key={member.id}>
                  <td className="border-b border-r border-line-divider px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {member.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-ink">{member.name}</p>
                        <p className="text-[11px] text-ink-muted">
                          {member.position ? positionLabel(member.position, member.customPosition) : "Unassigned"}
                        </p>
                        <p className="text-[11px] text-ink-muted/70">
                          {Math.round(memberHours(member.id) * 10) / 10} hrs this week
                        </p>
                      </div>
                    </div>
                  </td>
                  {weekDates.map((date, di) => {
                    const cellShifts = shiftsByCell.get(`${member.id}|${date}`) ?? [];
                    const dayOff = (member.availabilityOff ?? []).includes(dayIndex(date));
                    return (
                      <td
                        key={date}
                        className={`group border-b border-line-divider px-1.5 py-1.5 align-middle ${
                          isToday(date) ? "bg-primary/[0.03]" : ""
                        } ${di < 6 ? "border-r" : ""}`}
                        style={{ height: 80 }}
                      >
                        {cellShifts.map((shift) => {
                          const style = SHIFT_STYLES[shift.position];
                          const swappedWith = swapTagByShiftId[shift.id];
                          return (
                            <button
                              key={shift.id}
                              onClick={() => setDialogState({ mode: "edit", shift })}
                              className="relative mb-1 block w-full rounded-[5px] border-l-[3px] px-2 py-2.5 text-left transition-shadow hover:shadow-md"
                              style={{
                                borderColor: style.border,
                                backgroundColor: style.bg,
                                color: style.text,
                              }}
                            >
                              <span className="block text-xs font-semibold">
                                {shift.startTime}–{shift.endTime}
                              </span>
                              <span className="mt-1 block text-[11px] opacity-80">
                                {positionLabel(shift.position, shift.customPosition)}
                              </span>
                              {swappedWith && (
                                <span
                                  className="mt-1 flex items-center gap-1 text-[10px] font-semibold opacity-90"
                                  title={`This shift was swapped with ${swappedWith}`}
                                >
                                  <ArrowRightLeft className="size-2.5 shrink-0" />
                                  <span className="truncate">Swapped w/ {swappedWith}</span>
                                </span>
                              )}
                              {shift.draft && (
                                <span
                                  className="absolute right-1.5 top-1.5 size-[6px] rounded-full border border-current"
                                  title="Draft — not yet published"
                                />
                              )}
                            </button>
                          );
                        })}
                        {cellShifts.length === 0 && dayOff ? (
                          <div className="text-center text-[11px] text-muted-foreground/60">
                            Unavailable
                          </div>
                        ) : isOwner ? (
                          <button
                            onClick={() =>
                              setDialogState({ mode: "create", userId: member.id, date, weekDates })
                            }
                            aria-label={
                              cellShifts.length > 0
                                ? `Add another shift for ${member.name} on ${date}`
                                : `Add a shift for ${member.name} on ${date}`
                            }
                            className={
                              cellShifts.length > 0
                                ? "flex h-6 w-full items-center justify-center gap-1 rounded-[5px] border border-dashed border-muted-foreground/20 text-[11px] text-muted-foreground/50 transition-colors hover:border-primary/40 hover:bg-primary/[0.03] hover:text-primary"
                                : "flex h-[60px] w-full items-center justify-center rounded-[5px] border border-dashed border-transparent text-lg text-muted-foreground/30 transition-colors hover:border-primary/40 hover:bg-primary/[0.03] hover:text-primary"
                            }
                          >
                            {cellShifts.length > 0 ? "+ Add shift" : "+"}
                          </button>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {filteredMembers.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-sm text-ink-muted">
                    No team members match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-between border-t border-line-divider bg-surface-footer px-5 py-3 text-xs text-ink-muted">
          <span>
            <span
              className={`mr-1.5 inline-block size-1.5 rounded-full ${hasDrafts ? "bg-warning" : "bg-success"}`}
            />
            {hasDrafts ? "Unpublished changes" : "Published schedule"} &middot; {shifts.length} shifts
          </span>
          <span>Times shown in restaurant timezone</span>
        </div>
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

function dayIndex(dateStr: string): number {
  const d = new Date(dateStr + "T12:00:00Z");
  return (d.getUTCDay() + 6) % 7;
}
