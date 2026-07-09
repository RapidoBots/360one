"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ReservationBadge } from "../reservations/reservation-badge";
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

export function CustomerList({ customers }: { customers: CustomerRow[] }) {
  const [selected, setSelected] = useState<CustomerRow | null>(null);

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
            <SheetTitle>{selected?.name}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-2 px-4">
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
        </SheetContent>
      </Sheet>
    </>
  );
}
