"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SectionCard, FieldLabel } from "@/components/ui/section-card";
import { createTimeOffRequestAction, reviewTimeOffRequestAction } from "./actions";
import type { TimeOffRequestData } from "./staff-page-client";

const fieldClass =
  "h-11 w-full rounded-xl border-line-input bg-white px-3.5 text-sm font-medium text-ink focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/16";

export function TimeOffRequests({
  slug,
  requests,
  isOwner,
}: {
  slug: string;
  requests: TimeOffRequestData[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  async function handleReview(id: string, approve: boolean) {
    setActing(id);
    const result = await reviewTimeOffRequestAction(slug, id, approve);
    setActing(null);
    if (!result.ok) {
      toast.error(result.error);
    } else {
      toast.success(approve ? "Request approved" : "Request declined");
      router.refresh();
    }
  }

  return (
    <SectionCard
      icon={ClipboardList}
      title="All requests"
      description="Time off submitted by your team."
      headerRight={
        <Button className="h-10 gap-1.5 rounded-xl text-xs font-semibold" onClick={() => setShowAdd(true)}>
          <Plus className="size-3.5" />
          Request time off
        </Button>
      }
    >
      <div className="divide-y divide-line-divider border-t border-line-divider">
        {requests.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 px-7 py-3.5">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {r.user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">{r.user.name}</p>
              <p className="text-xs text-ink-muted">
                {formatDate(r.fromDate)}
                {r.toDate !== r.fromDate && ` – ${formatDate(r.toDate)}`}
                {r.reason && ` · ${r.reason}`}
              </p>
            </div>
            <StatusPill status={r.status} />
            {isOwner && r.status === "PENDING" && (
              <div className="flex gap-1.5">
                <Button
                  variant="outline" size="sm" className="rounded-lg text-xs"
                  disabled={acting === r.id}
                  onClick={() => handleReview(r.id, false)}
                >
                  Decline
                </Button>
                <Button
                  size="sm" className="rounded-lg text-xs"
                  disabled={acting === r.id}
                  onClick={() => handleReview(r.id, true)}
                >
                  Approve
                </Button>
              </div>
            )}
          </div>
        ))}
        {requests.length === 0 && (
          <p className="py-12 text-center text-sm text-ink-muted">No requests yet.</p>
        )}
      </div>

      <AddTimeOffDialog slug={slug} open={showAdd} onOpenChange={setShowAdd} />
    </SectionCard>
  );
}

function AddTimeOffDialog({
  slug, open, onOpenChange,
}: {
  slug: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!from || !to) return;
    setSaving(true);
    const result = await createTimeOffRequestAction(slug, {
      fromDate: from,
      toDate: to,
      reason: reason || undefined,
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
    } else {
      toast.success("Time-off request submitted");
      onOpenChange(false);
      setFrom("");
      setTo("");
      setReason("");
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-[480px] sm:max-w-[480px] gap-0 rounded-[20px] p-0">
        <div className="flex items-center justify-between gap-3 border-b border-line-divider px-6 py-5.5">
          <DialogTitle className="text-lg font-bold tracking-tight text-ink">Request time off</DialogTitle>
          <button
            type="button"
            aria-label="Close dialog"
            onClick={() => onOpenChange(false)}
            className="flex size-9 items-center justify-center rounded-[10px] text-[#475569] hover:bg-[#F1F3F9]"
          >
            <X className="size-[18px]" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-5 p-6">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-2">
                <FieldLabel>From</FieldLabel>
                <Input type="date" className={fieldClass} value={from} onChange={(e) => setFrom(e.target.value)} required />
              </label>
              <label className="flex flex-col gap-2">
                <FieldLabel>Through</FieldLabel>
                <Input type="date" className={fieldClass} value={to} onChange={(e) => setTo(e.target.value)} required />
              </label>
            </div>
            <label className="flex flex-col gap-2">
              <FieldLabel>Reason (optional)</FieldLabel>
              <Input className={fieldClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional note" maxLength={100} />
            </label>
          </div>
          <div className="flex justify-end gap-2.5 rounded-b-[20px] border-t border-line-divider bg-surface-footer px-6 py-4">
            <Button
              type="submit"
              disabled={saving}
              className="h-11 rounded-xl px-5.5 text-sm font-bold shadow-[0_6px_16px_-6px_var(--primary)]"
            >
              {saving ? <><Loader2 className="mr-2 size-4 animate-spin" />Submitting...</> : "Submit request"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: "bg-warning-soft text-warning",
    APPROVED: "bg-success-soft text-success",
    DECLINED: "bg-danger-soft text-danger",
  };
  const labels: Record<string, string> = {
    PENDING: "Pending",
    APPROVED: "Approved",
    DECLINED: "Declined",
  };
  return (
    <span className={`rounded-md px-2 py-1 text-[11px] font-medium ${styles[status] ?? ""}`}>
      {labels[status] ?? status}
    </span>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "UTC" });
}
