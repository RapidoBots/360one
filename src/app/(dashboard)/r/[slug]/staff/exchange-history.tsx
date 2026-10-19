"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requestShiftExchangeAction, reviewShiftExchangeAction } from "./actions";
import type { StaffMember, ShiftData, ExchangeData } from "./staff-page-client";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return d.toLocaleDateString([], { month: "short", day: "numeric", timeZone: "UTC" });
}

function formatTime(t: string): string {
  const parts = t.split(":").map(Number);
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12}${ampm}` : `${h12}:${m.toString().padStart(2, "0")}${ampm}`;
}

const STATUS_VARIANT: Record<string, "default" | "outline" | "destructive"> = {
  PENDING: "outline",
  APPROVED: "default",
  REJECTED: "destructive",
};

export function ExchangeHistory({
  slug,
  exchanges,
  shifts,
  members,
  currentUserId,
  isStaffView,
}: {
  slug: string;
  exchanges: ExchangeData[];
  shifts: ShiftData[];
  members: StaffMember[];
  currentUserId?: string;
  isStaffView?: boolean;
}) {
  const router = useRouter();
  const [fromShiftId, setFromShiftId] = useState<string | null>(null);
  const [toShiftId, setToShiftId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!fromShiftId || !toShiftId) {
      toast.error("Select both shifts to exchange.");
      return;
    }
    setSubmitting(true);
    const result = await requestShiftExchangeAction(slug, {
      requesterShiftId: fromShiftId,
      targetShiftId: toShiftId,
      note: note || undefined,
    });
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Exchange request submitted");
    setFromShiftId(null);
    setToShiftId(null);
    setNote("");
    router.refresh();
  }

  async function handleReview(exchangeId: string, approve: boolean) {
    setReviewingId(exchangeId);
    const result = await reviewShiftExchangeAction(slug, exchangeId, approve);
    setReviewingId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(approve ? "Exchange approved — shifts swapped" : "Exchange rejected");
    router.refresh();
  }

  // Staff can only offer their own shifts; owners see all
  const fromShifts = isStaffView && currentUserId
    ? shifts.filter((s) => s.userId === currentUserId)
    : shifts;
  // "To" shows other people's shifts (excluding the selected "from" shift)
  const toShifts = isStaffView && currentUserId
    ? shifts.filter((s) => s.id !== fromShiftId && s.userId !== currentUserId)
    : shifts.filter((s) => s.id !== fromShiftId);
  // Staff sees only their own exchanges; owners see all
  const visibleExchanges = isStaffView && currentUserId
    ? exchanges.filter(
        (e) => e.requesterShift.user.id === currentUserId || e.targetShift.user.id === currentUserId
      )
    : exchanges;

  function shiftOptionLabel(s: ShiftData): string {
    const member = members.find((m) => m.id === s.userId);
    return `${member?.name ?? "?"} — ${formatDate(s.date)} ${formatTime(s.startTime)}–${formatTime(s.endTime)}`;
  }

  return (
    <div className="space-y-6">
      {/* New exchange request */}
      <div className="rounded-xl border border-border bg-card p-5 ring-1 ring-foreground/5">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <ArrowRightLeft className="size-4" />
          Request Shift Exchange
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {isStaffView
            ? "Pick one of your shifts and a colleague's shift to swap. They'll review your request."
            : "Swap two shifts between staff members. The owner reviews and approves."}
        </p>
        <form onSubmit={handleRequest} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
            <div className="min-w-0 space-y-1.5">
              <Label>{isStaffView ? "Your shift" : "From shift"}</Label>
              <NativeSelect
                className="h-10 text-sm"
                value={fromShiftId ?? ""}
                disabled={fromShifts.length === 0}
                onChange={(e) => {
                  setFromShiftId(e.target.value || null);
                  // the colleague-shift list depends on which shift is "from" —
                  // clear it so a stale, no-longer-valid selection can't be submitted
                  setToShiftId(null);
                }}
              >
                <option value="" disabled>
                  {fromShifts.length === 0
                    ? "No shifts available."
                    : isStaffView
                      ? "Select your shift to give up"
                      : "Select shift to give up"}
                </option>
                {fromShifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {shiftOptionLabel(s)}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="hidden items-center justify-center pb-2.5 text-muted-foreground sm:flex">
              <ArrowRightLeft className="size-4" />
            </div>

            <div className="min-w-0 space-y-1.5">
              <Label>{isStaffView ? "Colleague's shift" : "To shift"}</Label>
              <NativeSelect
                className="h-10 text-sm"
                value={toShiftId ?? ""}
                disabled={toShifts.length === 0}
                onChange={(e) => setToShiftId(e.target.value || null)}
              >
                <option value="" disabled>
                  {toShifts.length > 0
                    ? isStaffView
                      ? "Select colleague's shift to receive"
                      : "Select shift to receive"
                    : fromShiftId
                      ? "No other shifts to swap with."
                      : "Select your shift first."}
                </option>
                {toShifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {shiftOptionLabel(s)}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Note (optional)</Label>
            <Input className="h-10 text-sm" placeholder="Reason for the swap..." value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <Button type="submit" disabled={submitting} className="h-10 gap-2 px-5">
            <ArrowRightLeft className="size-3.5" />
            {submitting ? <><Loader2 className="mr-2 size-4 animate-spin" />Submitting...</> : "Submit exchange request"}
          </Button>
        </form>
      </div>

      {/* Exchange history */}
      <div className="rounded-xl border border-border bg-card ring-1 ring-foreground/5">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-base font-semibold">Exchange History</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Track all shift swap requests and their outcomes.
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleExchanges.map((ex) => {
              // Staff can only approve/reject exchanges targeting their shift
              const canReview = isStaffView
                ? currentUserId === ex.targetShift.user.id
                : true;
              return (
              <TableRow key={ex.id}>
                <TableCell>
                  <div className="text-sm font-medium">{ex.requesterShift.user.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(ex.requesterShift.date)} {formatTime(ex.requesterShift.startTime)}–{formatTime(ex.requesterShift.endTime)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm font-medium">{ex.targetShift.user.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(ex.targetShift.date)} {formatTime(ex.targetShift.startTime)}–{formatTime(ex.targetShift.endTime)}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[ex.status] ?? "outline"}>
                    {ex.status.charAt(0) + ex.status.slice(1).toLowerCase()}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(ex.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  {ex.status === "PENDING" && canReview && (
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label="Approve"
                        onClick={() => handleReview(ex.id, true)}
                        disabled={reviewingId === ex.id}
                      >
                        <Check className="size-3.5 text-green-600" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label="Reject"
                        onClick={() => handleReview(ex.id, false)}
                        disabled={reviewingId === ex.id}
                      >
                        <X className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                  )}
                  {ex.status === "PENDING" && !canReview && isStaffView && (
                    <span className="text-xs text-muted-foreground">Awaiting response</span>
                  )}
                </TableCell>
              </TableRow>
              );
            })}
            {visibleExchanges.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                  No exchange requests yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
