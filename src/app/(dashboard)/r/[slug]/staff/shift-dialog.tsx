"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { createShiftAction, createBulkShiftsAction, updateShiftAction, deleteShiftAction } from "./actions";
import { POSITION_LABELS, POSITION_COLORS } from "./constants";
import { positionLabel } from "./position-utils";
import type { StaffMember, ShiftData } from "./staff-page-client";
import type { StaffPosition } from "@/generated/prisma/client";

const POSITIONS: StaffPosition[] = ["SERVER", "HOST", "CHEF", "BARTENDER", "MANAGER", "OTHER"];
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{state.mode === "edit" ? "Edit Shift" : "Add Shift"}</DialogTitle>
          <DialogDescription>
            {memberName()} — {state.mode === "edit" ? dateLabel() : "Select days below"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {state.mode === "create" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Days</Label>
                <button type="button" onClick={selectAllDays} className="text-xs text-primary hover:underline">
                  {selectedDays.every(Boolean) ? "Deselect all" : "Select all"}
                </button>
              </div>
              <div className="flex gap-1.5">
                {DAY_NAMES.map((name, i) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={`flex-1 rounded-lg border py-2 text-center text-xs font-medium transition-colors ${
                      selectedDays[i]
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="shiftStart">Start time</Label>
              <Input
                id="shiftStart"
                type="time"
                className="h-10 text-sm"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="shiftEnd">End time</Label>
              <Input
                id="shiftEnd"
                type="time"
                className="h-10 text-sm"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="shiftPosition">Position</Label>
            <Select value={position} onValueChange={(v) => v && setPosition(v as StaffPosition)}>
              <SelectTrigger id="shiftPosition" className="h-10 text-sm">
                <SelectValue>
                  {(value: string) => (
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block size-2.5 rounded-full"
                        style={{ backgroundColor: POSITION_COLORS[value as StaffPosition] }}
                      />
                      {positionLabel(value as StaffPosition, value === "OTHER" ? customPosition : null)}
                    </span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {POSITIONS.map((p) => (
                  <SelectItem key={p} value={p}>
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block size-2 rounded-full"
                        style={{ backgroundColor: POSITION_COLORS[p] }}
                      />
                      {POSITION_LABELS[p]}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {position === "OTHER" && (
            <div className="space-y-1.5">
              <Label htmlFor="customPos">Custom role name</Label>
              <Input
                id="customPos"
                className="h-10 text-sm"
                placeholder="e.g. Sommelier, Pastry Chef..."
                value={customPosition}
                onChange={(e) => setCustomPosition(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="shiftNotes">Notes (optional)</Label>
            <Input
              id="shiftNotes"
              className="h-10 text-sm"
              placeholder="e.g. Training, cover for Alice..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {state.mode === "edit" && (
            <Button
              variant="outline"
              className="mr-auto gap-2 text-destructive"
              onClick={handleDelete}
              disabled={deleting || saving}
            >
              <Trash2 className="size-3.5" />
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving || deleting} className="h-10 px-5">
            {saving ? "Saving..." : state.mode === "edit" ? "Save changes" : `Add shift${selectedDays.filter(Boolean).length > 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
