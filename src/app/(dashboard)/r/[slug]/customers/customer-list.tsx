"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, Users, Repeat, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReservationBadge } from "../reservations/reservation-badge";
import { updateCustomerAction, deleteCustomerAction } from "./actions";
import type { ReservationStatus } from "@/generated/prisma/client";

export type CustomerRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  reservations: {
    id: string;
    startsAt: Date;
    partySize: number;
    status: ReservationStatus;
    table: { number: string } | null;
  }[];
};

const AVATAR_PALETTE: [string, string][] = [
  ["#EEF2FF", "#3730A3"],
  ["#FFF4E5", "#B45309"],
  ["#ECFDF3", "#15803D"],
  ["#FDF2F8", "#BE185D"],
  ["#F0F9FF", "#0369A1"],
];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return "?";
  const last = parts.length > 1 ? parts[parts.length - 1] : undefined;
  return ((first[0] ?? "") + (last?.[0] ?? "")).toUpperCase();
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <div className="flex items-center gap-4 rounded-[20px] border border-line-card bg-white px-6 py-5 shadow-card">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-primary/10 text-primary">
        <Icon className="size-[22px]" strokeWidth={1.8} />
      </div>
      <div>
        <div className="text-[26px] leading-tight font-extrabold tracking-tight text-ink">{value}</div>
        <div className="mt-0.5 text-[13px] text-ink-muted">{label}</div>
      </div>
    </div>
  );
}

export function CustomerList({ slug, customers, canEdit = true }: { slug: string; customers: CustomerRow[]; canEdit?: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CustomerRow | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selected) return;
    setEditing(false);
    setError(null);
    setName(selected.name);
    setEmail(selected.email ?? "");
    setPhone(selected.phone ?? "");
  }, [selected]);

  const totalReservations = customers.reduce((sum, c) => sum + c.reservations.length, 0);
  const repeatGuests = customers.filter((c) => c.reservations.length >= 2).length;

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      customers.filter(
        (c) =>
          !q ||
          c.name.toLowerCase().includes(q) ||
          (c.phone ?? "").toLowerCase().includes(q)
      ),
    [customers, q]
  );

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    const toastId = toast.loading("Saving customer...");
    const result = await updateCustomerAction(slug, selected.id, { name, email, phone });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      toast.error(result.error, { id: toastId });
      return;
    }
    toast.success("Customer saved.", { id: toastId });
    setEditing(false);
    setSelected(null);
    router.refresh();
  }

  async function handleDelete() {
    if (!selected) return;
    const reservationCount = selected.reservations.length;
    const warning = reservationCount > 0 ? ` and their ${reservationCount} reservation${reservationCount === 1 ? "" : "s"}` : "";
    if (!window.confirm(`Delete ${selected.name}${warning}? This cannot be undone.`)) return;
    setDeleting(true);
    setError(null);
    const toastId = toast.loading("Deleting customer...");
    const result = await deleteCustomerAction(slug, selected.id);
    setDeleting(false);
    if (!result.ok) {
      setError(result.error);
      toast.error(result.error, { id: toastId });
      return;
    }
    toast.success("Customer deleted.", { id: toastId });
    setSelected(null);
    router.refresh();
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 [@media(min-width:520px)]:grid-cols-3">
        <StatCard icon={Users} label="Total customers" value={customers.length} />
        <StatCard icon={Repeat} label="Repeat guests" value={repeatGuests} />
        <StatCard icon={CalendarClock} label="Total reservations" value={totalReservations} />
      </div>

      <div className="overflow-hidden rounded-[20px] border border-line-card bg-white shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-4 px-7 py-6">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-ink">All customers</h2>
            <p className="mt-0.5 text-[13.5px] text-ink-muted">
              {q ? `${filtered.length} of ${customers.length} customers` : `${customers.length} customers`}
            </p>
          </div>
          <label className="relative flex w-full max-w-[320px] min-w-[200px] flex-1 items-center">
            <Search className="pointer-events-none absolute left-3.5 size-[17px] text-ink-placeholder" />
            <span className="sr-only">Search customers</span>
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or phone"
              className="h-11 w-full rounded-xl border-line-input pl-[42px] text-sm font-medium text-ink placeholder:text-ink-placeholder focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/16"
            />
          </label>
        </div>
        <div className="overflow-x-auto border-t border-line-divider">
          <Table className="min-w-[600px]">
            <TableHeader>
              <TableRow className="bg-surface-footer hover:bg-surface-footer">
                <TableHead className="px-7 py-3 text-[12px] font-bold tracking-wider text-ink-muted uppercase">Name</TableHead>
                <TableHead className="px-4 py-3 text-[12px] font-bold tracking-wider text-ink-muted uppercase">Contact</TableHead>
                <TableHead className="px-4 py-3 text-[12px] font-bold tracking-wider text-ink-muted uppercase">Reservations</TableHead>
                <TableHead className="px-4 py-3 pr-7 text-[12px] font-bold tracking-wider text-ink-muted uppercase">Last visit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c, i) => {
                const sorted = [...c.reservations].sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
                const [avBg, avColor] = AVATAR_PALETTE[i % AVATAR_PALETTE.length]!;
                const count = c.reservations.length;
                const countStyle =
                  count >= 2
                    ? { bg: "bg-success-soft", color: "text-success" }
                    : count === 1
                    ? { bg: "bg-[#EEF2FF]", color: "text-[#3730A3]" }
                    : { bg: "bg-neutral-soft", color: "text-ink-muted" };
                return (
                  <TableRow key={c.id} onClick={() => setSelected(c)} className="cursor-pointer border-line-divider hover:bg-[#FAFBFE]">
                    <TableCell className="px-7 py-4">
                      <div className="flex items-center gap-3">
                        <span
                          className="flex size-9 shrink-0 items-center justify-center rounded-full text-[12.5px] font-extrabold"
                          style={{ backgroundColor: avBg, color: avColor }}
                        >
                          {initialsOf(c.name)}
                        </span>
                        <span className="font-semibold text-ink">{c.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className={`px-4 py-4 ${c.phone || c.email ? "text-[#475569]" : "text-ink-placeholder"}`}>
                      {c.phone || c.email || "—"}
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <span className={`inline-block min-w-7 rounded-full px-2.5 py-1 text-center text-[12.5px] font-bold ${countStyle.bg} ${countStyle.color}`}>
                        {count}
                      </span>
                    </TableCell>
                    <TableCell className={`px-4 py-4 pr-7 ${sorted[0] ? "text-ink" : "text-ink-placeholder"}`}>
                      {sorted[0] ? sorted[0].startsAt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {filtered.length === 0 && (
            <div className="border-t border-line-divider px-5 py-10 text-center text-sm text-ink-muted">
              No customers match your search.
            </div>
          )}
        </div>
      </div>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editing ? "Edit customer" : selected?.name}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4 px-4">
            {editing ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="customerName">Name</Label>
                  <Input id="customerName" className="h-11 text-base" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customerEmail">Email</Label>
                  <Input id="customerEmail" type="email" className="h-11 text-base" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customerPhone">Phone</Label>
                  <Input id="customerPhone" type="tel" className="h-11 text-base" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                {error && <p className="text-base text-destructive">{error}</p>}
                <div className="flex gap-3">
                  <Button className="h-11 flex-1 text-base" disabled={saving} onClick={handleSave}>
                    {saving ? <><Loader2 className="mr-2 size-4 animate-spin" />Saving...</> : "Save changes"}
                  </Button>
                  <Button variant="outline" className="h-11 text-base" disabled={saving} onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              canEdit && (
                <div className="flex gap-3">
                  <Button variant="outline" className="h-9 text-base" onClick={() => setEditing(true)}>
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    className="h-9 text-base text-destructive"
                    disabled={deleting}
                    onClick={handleDelete}
                  >
                    {deleting ? "Deleting..." : "Delete"}
                  </Button>
                </div>
              )
            )}

            {!editing && error && <p className="text-base text-destructive">{error}</p>}

            {!editing && (
              <div className="space-y-2">
                {selected?.reservations
                  .slice()
                  .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())
                  .map((r) => (
                    <div key={r.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div>
                        <p className="font-medium">{r.startsAt.toLocaleString()}</p>
                        <p className="text-base text-muted-foreground">
                          Party of {r.partySize}
                          {r.table ? ` · Table ${r.table.number}` : ""}
                        </p>
                      </div>
                      <ReservationBadge status={r.status} />
                    </div>
                  ))}
                {selected && selected.reservations.length === 0 && (
                  <p className="text-base text-muted-foreground">No reservations yet.</p>
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
