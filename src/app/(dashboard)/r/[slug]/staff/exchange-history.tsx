"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import { SectionCard, FieldLabel } from "@/components/ui/section-card";
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

const fieldClass =
  "h-11 w-full rounded-xl border-line-input bg-white px-3.5 text-sm font-medium text-ink focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/16";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

function formatTime(t: string): string {
  const parts = t.split(":").map(Number);
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12}${ampm}` : `${h12}:${m.toString().padStart(2, "0")}${ampm}`;
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-warning-soft text-warning",
  APPROVED: "bg-success-soft text-success",
  REJECTED: "bg-danger-soft text-danger",
};

function ExchangeStatusPill({ status }: { status: string }) {
  return (
    <span className={`rounded-md px-2 py-1 text-[11px] font-medium ${STATUS_STYLES[status] ?? ""}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

// One side of the exchange: pick a team member, then pick one of their
// shifts. Staff requesting their own side skip straight to the shift list
// (fixedPersonId) -- they can only give up their own shifts.
function PersonShiftPicker({
  label,
  members,
  shifts,
  excludePersonId,
  fixedPersonId,
  personId,
  onPersonChange,
  shiftId,
  onShiftChange,
}: {
  label: string;
  members: StaffMember[];
  shifts: ShiftData[];
  excludePersonId?: string | null;
  fixedPersonId?: string;
  personId: string | null;
  onPersonChange: (id: string | null) => void;
  shiftId: string | null;
  onShiftChange: (id: string | null) => void;
}) {
  const effectivePersonId = fixedPersonId ?? personId;
  const personShifts = effectivePersonId ? shifts.filter((s) => s.userId === effectivePersonId) : [];
  const fixedMember = fixedPersonId ? members.find((m) => m.id === fixedPersonId) : undefined;

  return (
    <div className="min-w-0 flex-1 space-y-2.5 rounded-xl border border-line-card bg-white p-3.5">
      <FieldLabel>{label}</FieldLabel>

      {fixedPersonId ? (
        <div className="flex items-center gap-2 text-sm font-medium text-ink">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
            {(fixedMember?.name ?? "You").slice(0, 2).toUpperCase()}
          </span>
          {fixedMember?.name ?? "You"}
        </div>
      ) : (
        <NativeSelect
          className={`${fieldClass} h-10`}
          value={personId ?? ""}
          onChange={(e) => {
            onPersonChange(e.target.value || null);
            onShiftChange(null);
          }}
        >
          <option value="" disabled>
            Select a team member
          </option>
          {members
            .filter((m) => m.id !== excludePersonId)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
        </NativeSelect>
      )}

      {effectivePersonId && (
        <div className="max-h-56 space-y-1.5 overflow-y-auto">
          {personShifts.length === 0 ? (
            <p className="py-3 text-center text-xs text-ink-muted">
              {fixedPersonId ? "You have no shifts to offer." : "This person has no shifts."}
            </p>
          ) : (
            personShifts.map((s) => {
              const selected = s.id === shiftId;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onShiftChange(s.id)}
                  className={`block w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    selected
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-line-divider hover:bg-surface-footer"
                  }`}
                >
                  <span className="block font-medium text-ink">{formatDate(s.date)}</span>
                  <span className="block text-xs text-ink-muted">
                    {formatTime(s.startTime)}–{formatTime(s.endTime)}
                    {s.draft && " · Draft"}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

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
  const [fromPersonId, setFromPersonId] = useState<string | null>(null);
  const [fromShiftId, setFromShiftId] = useState<string | null>(null);
  const [toPersonId, setToPersonId] = useState<string | null>(null);
  const [toShiftId, setToShiftId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const fixedFromPersonId = isStaffView ? currentUserId : undefined;
  const effectiveFromPersonId = fixedFromPersonId ?? fromPersonId;

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
    setFromPersonId(null);
    setFromShiftId(null);
    setToPersonId(null);
    setToShiftId(null);
    setNote("");
    router.refresh();
  }

  async function handleReview(exchange: ExchangeData, approve: boolean) {
    setReviewingId(exchange.id);
    try {
      const result = await reviewShiftExchangeAction(slug, exchange.id, approve);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const fromName = exchange.requesterUserName ?? exchange.requesterShift.user.name;
      const toName = exchange.targetUserName ?? exchange.targetShift.user.name;
      toast.success(
        approve
          ? `Swapped: ${fromName} ⇄ ${toName} now have each other's shift`
          : `Rejected the exchange between ${fromName} and ${toName}`
      );
      router.refresh();
    } catch {
      toast.error("Something went wrong — please try again.");
    } finally {
      setReviewingId(null);
    }
  }

  // Staff sees only their own exchanges; owners see all
  const visibleExchanges = isStaffView && currentUserId
    ? exchanges.filter(
        (e) => e.requesterShift.user.id === currentUserId || e.targetShift.user.id === currentUserId
      )
    : exchanges;

  return (
    <div className="space-y-6">
      {/* New exchange request */}
      <SectionCard
        icon={ArrowRightLeft}
        title="Request shift exchange"
        description={
          isStaffView
            ? "Pick one of your shifts, then a colleague and one of their shifts to swap with."
            : "Pick a team member and shift on each side to swap. The owner reviews and approves."
        }
      >
        <form onSubmit={handleRequest} className="flex flex-col gap-4 border-t border-line-divider p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <PersonShiftPicker
              label={isStaffView ? "Giving up" : "From"}
              members={members}
              shifts={shifts}
              excludePersonId={toPersonId}
              fixedPersonId={fixedFromPersonId}
              personId={fromPersonId}
              onPersonChange={setFromPersonId}
              shiftId={fromShiftId}
              onShiftChange={setFromShiftId}
            />
            <div className="hidden items-center justify-center pt-8 text-ink-muted sm:flex">
              <ArrowRightLeft className="size-4" />
            </div>
            <PersonShiftPicker
              label={isStaffView ? "Receiving" : "To"}
              members={members}
              shifts={shifts}
              excludePersonId={effectiveFromPersonId}
              personId={toPersonId}
              onPersonChange={setToPersonId}
              shiftId={toShiftId}
              onShiftChange={setToShiftId}
            />
          </div>

          <label className="flex flex-col gap-2">
            <FieldLabel>Note (optional)</FieldLabel>
            <Input className={fieldClass} placeholder="Reason for the swap..." value={note} onChange={(e) => setNote(e.target.value)} />
          </label>

          <Button
            type="submit"
            disabled={submitting || !fromShiftId || !toShiftId}
            className="h-11 w-fit gap-2 rounded-xl px-5 text-sm font-semibold shadow-[0_6px_16px_-6px_var(--primary)]"
          >
            <ArrowRightLeft className="size-3.5" />
            {submitting ? <><Loader2 className="mr-2 size-4 animate-spin" />Submitting...</> : "Submit exchange request"}
          </Button>
        </form>
      </SectionCard>

      {/* Exchange history */}
      <SectionCard
        icon={ArrowRightLeft}
        title="Exchange history"
        description="Track all shift swap requests and their outcomes."
      >
        <Table>
          <TableHeader>
            <TableRow className="border-line-divider bg-surface-footer hover:bg-surface-footer">
              <TableHead className="text-[12px] font-bold tracking-wider text-ink-muted uppercase">From</TableHead>
              <TableHead className="text-[12px] font-bold tracking-wider text-ink-muted uppercase">To</TableHead>
              <TableHead className="text-[12px] font-bold tracking-wider text-ink-muted uppercase">Status</TableHead>
              <TableHead className="text-[12px] font-bold tracking-wider text-ink-muted uppercase">Date</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleExchanges.map((ex) => {
              // Staff can only approve/reject exchanges targeting their shift
              const canReview = isStaffView
                ? currentUserId === ex.targetShift.user.id
                : true;
              const fromName = ex.requesterUserName ?? ex.requesterShift.user.name;
              const toName = ex.targetUserName ?? ex.targetShift.user.name;
              return (
              <TableRow key={ex.id} className="border-line-divider">
                <TableCell>
                  <div className="text-sm font-semibold text-ink">{fromName}</div>
                  <div className="text-xs text-ink-muted">
                    {formatDate(ex.requesterShift.date)} {formatTime(ex.requesterShift.startTime)}–{formatTime(ex.requesterShift.endTime)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm font-semibold text-ink">{toName}</div>
                  <div className="text-xs text-ink-muted">
                    {formatDate(ex.targetShift.date)} {formatTime(ex.targetShift.startTime)}–{formatTime(ex.targetShift.endTime)}
                  </div>
                </TableCell>
                <TableCell>
                  <ExchangeStatusPill status={ex.status} />
                  {ex.status === "APPROVED" && (
                    <div className="mt-1 text-[11px] text-ink-muted">
                      {fromName} ⇄ {toName} swapped shifts
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-xs text-ink-muted">
                  {new Date(ex.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  {ex.status === "PENDING" && canReview && (
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label="Approve"
                        onClick={() => handleReview(ex, true)}
                        disabled={reviewingId === ex.id}
                      >
                        <Check className="size-3.5 text-success" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label="Reject"
                        onClick={() => handleReview(ex, false)}
                        disabled={reviewingId === ex.id}
                      >
                        <X className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                  )}
                  {ex.status === "PENDING" && !canReview && isStaffView && (
                    <span className="text-xs text-ink-muted">Awaiting response</span>
                  )}
                </TableCell>
              </TableRow>
              );
            })}
            {visibleExchanges.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-ink-muted">
                  No exchange requests yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </SectionCard>
    </div>
  );
}
