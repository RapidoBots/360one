"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

export function CustomerList({ slug, customers }: { slug: string; customers: CustomerRow[] }) {
  const router = useRouter();
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

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    const result = await updateCustomerAction(slug, selected.id, { name, email, phone });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditing(false);
    setSelected(null);
    router.refresh();
  }

  async function handleDelete() {
    if (!selected) return;
    if (!window.confirm(`Delete ${selected.name}? This cannot be undone.`)) return;
    setDeleting(true);
    setError(null);
    const result = await deleteCustomerAction(slug, selected.id);
    setDeleting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSelected(null);
    router.refresh();
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Reservations</TableHead>
            <TableHead>Last visit</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((c) => {
            const sorted = [...c.reservations].sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
            return (
              <TableRow key={c.id} onClick={() => setSelected(c)} className="cursor-pointer">
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.phone || c.email || "—"}</TableCell>
                <TableCell>{c.reservations.length}</TableCell>
                <TableCell>{sorted[0] ? sorted[0].startsAt.toLocaleDateString() : "—"}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

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
                    {saving ? "Saving..." : "Save changes"}
                  </Button>
                  <Button variant="outline" className="h-11 text-base" disabled={saving} onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
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
