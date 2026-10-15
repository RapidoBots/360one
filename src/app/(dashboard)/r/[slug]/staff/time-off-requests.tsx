"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTimeOffRequestAction, reviewTimeOffRequestAction } from "./actions";
import type { TimeOffRequestData } from "./staff-page-client";

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
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h3 className="text-sm font-semibold">All requests</h3>
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => setShowAdd(true)}>
          <Plus className="size-3.5" />
          Request time off
        </Button>
      </div>

      <div className="divide-y divide-border">
        {requests.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {r.user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{r.user.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatDate(r.fromDate)}
                {r.toDate !== r.fromDate && ` – ${formatDate(r.toDate)}`}
                {r.reason && ` · ${r.reason}`}
              </p>
            </div>
            <StatusPill status={r.status} />
            {isOwner && r.status === "PENDING" && (
              <div className="flex gap-1.5">
                <Button
                  variant="outline" size="sm" className="text-xs"
                  disabled={acting === r.id}
                  onClick={() => handleReview(r.id, false)}
                >
                  Decline
                </Button>
                <Button
                  size="sm" className="text-xs"
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
          <p className="py-12 text-center text-sm text-muted-foreground">No requests yet.</p>
        )}
      </div>

      <AddTimeOffDialog slug={slug} open={showAdd} onOpenChange={setShowAdd} />
    </div>
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request time off</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="toFrom">From</Label>
              <Input id="toFrom" type="date" value={from} onChange={(e) => setFrom(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="toTo">Through</Label>
              <Input id="toTo" type="date" value={to} onChange={(e) => setTo(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="toReason">Reason (optional)</Label>
            <Input id="toReason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional note" maxLength={100} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving} className="h-10 px-5">
              {saving ? <><Loader2 className="mr-2 size-4 animate-spin" />Submitting...</> : "Submit request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
    APPROVED: "bg-primary/10 text-primary",
    DECLINED: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400",
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
