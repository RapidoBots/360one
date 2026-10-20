"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { FieldLabel } from "@/components/ui/section-card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { createShiftAction, createBulkShiftsAction, updateShiftAction, deleteShiftAction } from "./actions";
import { POSITION_LABELS } from "./constants";
import type { StaffMember, ShiftData } from "./staff-page-client";
import type { StaffPosition } from "@/generated/prisma/client";

const POSITIONS: StaffPosition[] = ["SERVER", "HOST", "CHEF", "BARTENDER", "MANAGER", "OTHER"];
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const fieldClass =
  "h-11 w-full rounded-xl border-line-input bg-white px-3.5 text-sm font-medium text-ink focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/16";

type DialogState =
  | { mode: "closed" }
  | { mode: "create"; userId: string; date: string; weekDates: string[] }
  | { mode: "edit"; shift: ShiftData };

export function ShiftDialog({
  slug,
  state,
  members,
  onClose,
}: {
  slug: string;
  state: DialogState;
  members: StaffMember[];
  onClose: () => void;
}) {
  const router = useRouter();
  const open = state.mode !== "closed";

  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [position, setPosition] = useState<StaffPosition>("SERVER");
  const [customPosition, setCustomPosition] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedDays, setSelectedDays] = useState<boolean[]>([false, false, false, false, false, false, false]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (state.mode === "edit") {
      setStartTime(state.shift.startTime);
      setEndTime(state.shift.endTime);
      setPosition(state.shift.position);
      setCustomPosition(state.shift.customPosition ?? "");
      setNotes(state.shift.notes ?? "");
      setSelectedDays([false, false, false, false, false, false, false]);
    } else if (state.mode === "create") {
      const member = members.find((m) => m.id === state.userId);
      setStartTime("09:00");
      setEndTime("17:00");
      setPosition(member?.position ?? "SERVER");
      setCustomPosition(member?.customPosition ?? "");
      setNotes("");
      const dayIndex = state.weekDates.indexOf(state.date);
      const days = [false, false, false, false, false, false, false];
      if (dayIndex >= 0) days[dayIndex] = true;
      setSelectedDays(days);
    }
  }, [state, members]);

  function dateLabel(): string {
    if (state.mode === "closed") return "";
    const dateStr = state.mode === "create" ? state.date : state.shift.date;
    const d = new Date(dateStr + "T12:00:00Z");
    return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
  }

  function memberName(): string {
    if (state.mode === "closed") return "";
    const uid = state.mode === "create" ? state.userId : state.shift.userId;
    return members.find((m) => m.id === uid)?.name ?? "";
  }

  function toggleDay(i: number) {
    setSelectedDays((prev) => {
      const next = [...prev];
      next[i] = !next[i];
      return next;
    });
  }

  function selectAllDays() {
    const allSelected = selectedDays.every(Boolean);
    setSelectedDays(allSelected ? [false, false, false, false, false, false, false] : [true, true, true, true, true, true, true]);
  }

  async function handleSave() {
    setSaving(true);
    let result;
    if (state.mode === "create") {
      const dates = state.weekDates.filter((_, i) => selectedDays[i]);
      if (dates.length === 0) {
        toast.error("Select at least one day.");
        setSaving(false);
        return;
      }
      if (dates.length === 1) {
        result = await createShiftAction(slug, {
          userId: state.userId,
          date: dates[0]!,
          startTime,
          endTime,
          position,
          customPosition: position === "OTHER" ? customPosition : undefined,
          notes: notes || undefined,
        });
      } else {
        result = await createBulkShiftsAction(slug, {
          userId: state.userId,
          dates,
          startTime,
          endTime,
          position,
          customPosition: position === "OTHER" ? customPosition : undefined,
          notes: notes || undefined,
        });
      }
    } else if (state.mode === "edit") {
      result = await updateShiftAction(slug, state.shift.id, {
        startTime,
        endTime,
        position,
        customPosition: position === "OTHER" ? customPosition : undefined,
        notes: notes || undefined,
      });
    }
    setSaving(false);
    if (result && !result.ok) {
      toast.error(result.error);
      return;
    }
    const count = state.mode === "create" ? selectedDays.filter(Boolean).length : 1;
    toast.success(state.mode === "create" ? `${count} shift${count > 1 ? "s" : ""} added` : "Shift updated");
    router.refresh();
    onClose();
  }

  async function handleDelete() {
    if (state.mode !== "edit") return;
    if (!window.confirm("Delete this shift?")) return;
    setDeleting(true);
    const result = await deleteShiftAction(slug, state.shift.id);
    setDeleting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Shift deleted");
    router.refresh();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent showCloseButton={false} className="max-w-[480px] sm:max-w-[480px] gap-0 rounded-[20px] p-0">
        <div className="flex items-center justify-between gap-3 border-b border-line-divider px-6 py-5.5">
          <div>
            <DialogTitle className="text-lg font-bold tracking-tight text-ink">
              {state.mode === "edit" ? "Edit shift" : "Add shift"}
            </DialogTitle>
            <p className="mt-0.5 text-[13px] text-ink-muted">
              {memberName()} — {state.mode === "edit" ? dateLabel() : "Select days below"}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-[10px] text-[#475569] hover:bg-[#F1F3F9]"
          >
            <X className="size-[18px]" />
          </button>
        </div>

        <div className="flex flex-col gap-5 p-6">
          {state.mode === "create" && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <FieldLabel>Days</FieldLabel>
                <button type="button" onClick={selectAllDays} className="text-xs font-semibold text-primary hover:underline">
                  {selectedDays.every(Boolean) ? "Deselect all" : "Select all"}
                </button>
              </div>
              <div className="flex gap-1.5">
                {DAY_NAMES.map((name, i) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={`flex-1 rounded-xl border py-2 text-center text-xs font-semibold transition-colors ${
                      selectedDays[i]
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-line-input bg-white text-ink-muted hover:border-primary/50"
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-2">
              <FieldLabel>Start time</FieldLabel>
              <Input
                type="time"
                className={fieldClass}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-2">
              <FieldLabel>End time</FieldLabel>
              <Input
                type="time"
                className={fieldClass}
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </label>
          </div>

          <label className="flex flex-col gap-2">
            <FieldLabel>Position</FieldLabel>
            <NativeSelect
              className={`${fieldClass} pl-3.5 pr-9`}
              value={position}
              onChange={(e) => setPosition(e.target.value as StaffPosition)}
            >
              {POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {POSITION_LABELS[p]}
                </option>
              ))}
            </NativeSelect>
          </label>

          {position === "OTHER" && (
            <label className="flex flex-col gap-2">
              <FieldLabel>Custom role name</FieldLabel>
              <Input
                className={fieldClass}
                placeholder="e.g. Sommelier, Pastry Chef..."
                value={customPosition}
                onChange={(e) => setCustomPosition(e.target.value)}
              />
            </label>
          )}

          <label className="flex flex-col gap-2">
            <FieldLabel>Notes (optional)</FieldLabel>
            <Input
              className={fieldClass}
              placeholder="e.g. Training, cover for Alice..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>

        <div className="flex items-center justify-between gap-2.5 rounded-b-[20px] border-t border-line-divider bg-surface-footer px-6 py-4">
          {state.mode === "edit" ? (
            <Button
              type="button"
              variant="outline"
              className="gap-2 rounded-xl border-[#D5DAEA] text-sm font-semibold text-destructive"
              onClick={handleDelete}
              disabled={deleting || saving}
            >
              <Trash2 className="size-3.5" />
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          ) : <span />}
          <Button
            onClick={handleSave}
            disabled={saving || deleting}
            className="h-11 rounded-xl px-5.5 text-sm font-bold shadow-[0_6px_16px_-6px_var(--primary)]"
          >
            {saving ? <><Loader2 className="mr-2 size-4 animate-spin" />Saving...</> : state.mode === "edit" ? "Save changes" : `Add shift${selectedDays.filter(Boolean).length > 1 ? "s" : ""}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
