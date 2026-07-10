"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createReservationAction, updateReservationAction, type ReservationInput } from "./actions";
import { toLocalDateInput } from "@/lib/reservation-dates";
import type { ReservationStatus } from "@/generated/prisma/client";

export type TableOption = { id: string; number: string; capacity: number };

export type ReservationForEdit = {
  id: string;
  partySize: number;
  startsAt: Date;
  durationMinutes: number;
  status: ReservationStatus;
  specialRequests: string | null;
  tableId: string | null;
  customer: { name: string; email: string | null; phone: string | null };
};

const DURATION_OPTIONS = [30, 60, 90, 120, 150, 180, 210, 240, 270, 300];
const STATUS_OPTIONS: ReservationStatus[] = ["CONFIRMED", "SEATED", "COMPLETED", "CANCELLED", "NO_SHOW"];

function toDateInput(d: Date) {
  return toLocalDateInput(d);
}
function toTimeInput(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export type ReservationPrefill = { tableId?: string | null; date?: string; time?: string };

export function ReservationModal({
  open,
  onOpenChange,
  slug,
  tables,
  reservation,
  prefill,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  tables: TableOption[];
  reservation?: ReservationForEdit;
  prefill?: ReservationPrefill;
  onSaved: () => void;
}) {
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("19:00");
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [specialRequests, setSpecialRequests] = useState("");
  const [tableId, setTableId] = useState<string | null>(null);
  const [status, setStatus] = useState<ReservationStatus>("CONFIRMED");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (reservation) {
      setGuestName(reservation.customer.name);
      setGuestEmail(reservation.customer.email ?? "");
      setGuestPhone(reservation.customer.phone ?? "");
      setPartySize(reservation.partySize);
      setDate(toDateInput(reservation.startsAt));
      setTime(toTimeInput(reservation.startsAt));
      setDurationMinutes(reservation.durationMinutes);
      setSpecialRequests(reservation.specialRequests ?? "");
      setTableId(reservation.tableId);
      setStatus(reservation.status);
    } else {
      setGuestName("");
      setGuestEmail("");
      setGuestPhone("");
      setPartySize(2);
      setDate(prefill?.date ?? toDateInput(new Date()));
      setTime(prefill?.time ?? "19:00");
      setDurationMinutes(90);
      setSpecialRequests("");
      setTableId(prefill?.tableId ?? null);
      setStatus("CONFIRMED");
    }
  }, [open, reservation, prefill]);

  const availableTables = tables.filter((t) => t.capacity >= partySize);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const input: ReservationInput = {
      guestName,
      guestEmail,
      guestPhone,
      partySize,
      date,
      time,
      durationMinutes,
      specialRequests,
      tableId,
      status: reservation ? status : undefined,
    };

    const result = reservation
      ? await updateReservationAction(slug, reservation.id, input)
      : await createReservationAction(slug, input);

    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{reservation ? "Edit reservation" : "New reservation"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Guest information</h3>
            <div className="space-y-2">
              <Label htmlFor="guestName">Name</Label>
              <Input
                id="guestName"
                className="h-11 text-base"
                placeholder="Guest name"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="guestEmail">Email</Label>
                <Input
                  id="guestEmail"
                  type="email"
                  className="h-11 text-base"
                  placeholder="guest@example.com"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guestPhone">Phone</Label>
                <Input
                  id="guestPhone"
                  type="tel"
                  className="h-11 text-base"
                  placeholder="(555) 123-4567"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Reservation details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  className="h-11 text-base"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Time</Label>
                <Input
                  id="time"
                  type="time"
                  className="h-11 text-base"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="partySize">Party size</Label>
                <Input
                  id="partySize"
                  type="number"
                  min={1}
                  className="h-11 text-base"
                  placeholder="Number of guests"
                  value={partySize}
                  onChange={(e) => setPartySize(Number(e.target.value))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Duration</Label>
                <Select value={String(durationMinutes)} onValueChange={(v) => setDurationMinutes(Number(v))}>
                  <SelectTrigger className="h-11 w-full text-base">
                    <SelectValue>{(value: string) => `${value} min`}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {d} min
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="specialRequests">Special requests</Label>
              <Textarea
                id="specialRequests"
                className="text-base"
                placeholder="Any allergies, seating preferences, or occasion..."
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tableId">Assigned table</Label>
            <Select value={tableId ?? "none"} onValueChange={(v) => setTableId(v === "none" ? null : v)}>
              <SelectTrigger id="tableId" className="h-11 w-full text-base">
                <SelectValue placeholder="No table assigned">
                  {(value: string | null) => {
                    if (!value || value === "none") return "No table assigned";
                    const t = tables.find((table) => table.id === value);
                    return t ? `Table ${t.number} (seats ${t.capacity})` : "No table assigned";
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No table assigned</SelectItem>
                {availableTables.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    Table {t.number} (seats {t.capacity})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {reservation && (
            <div className="space-y-2">
              <Label htmlFor="status">Reservation status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ReservationStatus)}>
                <SelectTrigger id="status" className="h-11 w-full text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {error && <p className="text-base text-destructive">{error}</p>}

          <Button type="submit" className="h-12 w-full text-base" disabled={saving}>
            {saving ? "Saving..." : reservation ? "Save changes" : "Confirm reservation"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
