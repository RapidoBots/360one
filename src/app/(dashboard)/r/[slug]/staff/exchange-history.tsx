"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { positionLabel } from "./position-utils";
import { POSITION_COLORS } from "./constants";
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
}: {
  slug: string;
  exchanges: ExchangeData[];
  shifts: ShiftData[];
  members: StaffMember[];
}) {
  const router = useRouter();
  const [fromShiftId, setFromShiftId] = useState("");
  const [toShiftId, setToShiftId] = useState("");
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
    setFromShiftId("");
    setToShiftId("");
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
          Swap two shifts between staff members. The owner reviews and approves.
        </p>
        <form onSubmit={handleRequest} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>From shift</Label>
            <Select value={fromShiftId} onValueChange={(v) => v && setFromShiftId(v)}>
              <SelectTrigger className="h-10 text-xs">
                <SelectValue placeholder="Select shift to give up" />
              </SelectTrigger>
              <SelectContent>
                {shifts.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="flex items-center gap-2">
                      <span className="inline-block size-2 rounded-full" style={{ backgroundColor: POSITION_COLORS[s.position] }} />
                      {shiftOptionLabel(s)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>To shift</Label>
            <Select value={toShiftId} onValueChange={(v) => v && setToShiftId(v)}>
              <SelectTrigger className="h-10 text-xs">
                <SelectValue placeholder="Select shift to receive" />
              </SelectTrigger>
              <SelectContent>
                {shifts.filter((s) => s.id !== fromShiftId).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="flex items-center gap-2">
                      <span className="inline-block size-2 rounded-full" style={{ backgroundColor: POSITION_COLORS[s.position] }} />
                      {shiftOptionLabel(s)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Note (optional)</Label>
            <Input className="h-10 text-sm" placeholder="Reason for the swap..." value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={submitting} className="h-10 gap-2 px-5">
              <ArrowRightLeft className="size-3.5" />
              {submitting ? <><Loader2 className="mr-2 size-4 animate-spin" />Submitting...</> : "Submit exchange request"}
            </Button>
          </div>
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
            {exchanges.map((ex) => (
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
                  {ex.status === "PENDING" && (
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
                </TableCell>
              </TableRow>
            ))}
            {exchanges.length === 0 && (
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
