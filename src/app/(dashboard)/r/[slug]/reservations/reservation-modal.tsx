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
import {
  createReservationAction,
  updateReservationAction,
  deleteReservationAction,
  findCustomerByPhoneAction,
  type ReservationInput,
} from "./actions";
import { recommendTable } from "@/lib/table-allocation";
import { toLocalDateInput, zonedDateTimeToUtc } from "@/lib/reservation-dates";
import type { ReservationStatus } from "@/generated/prisma/client";
import type { ReservationListItem } from "./day-view";

export type TableOption = { id: string; number: string; capacity: number };

export type ReservationForEdit = {
  id: string;
  partySize: number;
  startsAt: Date;
  durationMinutes: number;
  status: ReservationStatus;
  specialRequests: string | null;
  internalNote: string | null;
  tableId: string | null;
  customer: { name: string; email: string | null; phone: string | null };
};

const DURATION_OPTIONS = [30, 60, 90, 120, 150, 180, 210, 240, 270, 300];
const STATUS_OPTIONS: ReservationStatus[] = ["PENDING", "CONFIRMED", "SEATED", "COMPLETED", "CANCELLED", "NO_SHOW"];

function toDateInput(d: Date, timeZone: string) {
  return toLocalDateInput(d, timeZone);
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
  reservations,
  reservation,
  prefill,
  defaultDurationMinutes,
  timeZone,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  tables: TableOption[];
  reservations: ReservationListItem[];
  reservation?: ReservationForEdit;
  prefill?: ReservationPrefill;
  defaultDurationMinutes: number;
  timeZone: string;
  onSaved: () => void;
}) {
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("19:00");
  const [durationMinutes, setDurationMinutes] = useState(defaultDurationMinutes);
  const [specialRequests, setSpecialRequests] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [tableId, setTableId] = useState<string | null>(null);
  const [tableTouched, setTableTouched] = useState(false);
  const [status, setStatus] = useState<ReservationStatus>("CONFIRMED");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Phone-first: a new reservation starts by asking for the guest's phone
  // number and looking them up, so a returning guest's name/email auto-fill
  // instead of being retyped every visit. Editing an existing reservation
  // skips straight to the full form -- it's already tied to a customer.
  const [phoneStep, setPhoneStep] = useState(!reservation);
  const [lookupPhone, setLookupPhone] = useState("");
  const [lookingUp, setLookingUp] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (reservation) {
      setPhoneStep(false);
      setGuestName(reservation.customer.name);
      setGuestEmail(reservation.customer.email ?? "");
      setGuestPhone(reservation.customer.phone ?? "");
      setPartySize(reservation.partySize);
      setDate(toDateInput(reservation.startsAt, timeZone));
      setTime(toTimeInput(reservation.startsAt));
      setDurationMinutes(reservation.durationMinutes);
      setSpecialRequests(reservation.specialRequests ?? "");
      setInternalNote(reservation.internalNote ?? "");
      setTableId(reservation.tableId);
      setTableTouched(true);
      setStatus(reservation.status);
    } else {
      setPhoneStep(true);
      setLookupPhone("");
      setGuestName("");
      setGuestEmail("");
      setGuestPhone("");
      setPartySize(2);
      setDate(prefill?.date ?? toDateInput(new Date(), timeZone));
      setTime(prefill?.time ?? "19:00");
      setDurationMinutes(defaultDurationMinutes);
      setSpecialRequests("");
      setInternalNote("");
      setTableId(prefill?.tableId ?? null);
      setTableTouched(!!prefill?.tableId);
      setStatus("CONFIRMED");
    }
  }, [open, reservation, prefill]);

  async function handlePhoneContinue(e: React.FormEvent) {
    e.preventDefault();
    setLookingUp(true);
    setError(null);
    const match = await findCustomerByPhoneAction(slug, lookupPhone);
    setLookingUp(false);
    setGuestPhone(lookupPhone);
    if (match) {
      setGuestName(match.name);
      setGuestEmail(match.email ?? "");
    } else {
      setGuestName("");
      setGuestEmail("");
    }
    setPhoneStep(false);
  }

  const availableTables = tables.filter((t) => t.capacity >= partySize);

  const recommendedId = !reservation && date
    ? recommendTable(
        tables.map((t) => ({ id: t.id, capacity: t.capacity })),
        reservations,
        { partySize, startsAt: zonedDateTimeToUtc(date, time, timeZone), durationMinutes }
      )
    : null;

  const effectiveTableId = tableTouched ? tableId : recommendedId;

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
      internalNote,
      tableId: effectiveTableId,
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

  async function handleDelete() {
    if (!reservation) return;
    if (!window.confirm(`Delete this reservation for ${reservation.customer.name}? This cannot be undone.`)) return;
    setDeleting(true);
    setError(null);
    const result = await deleteReservationAction(slug, reservation.id);
    setDeleting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-[calc(100%-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{reservation ? "Edit reservation" : "New reservation"}</DialogTitle>
        </DialogHeader>

        {phoneStep ? (
          <form onSubmit={handlePhoneContinue} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lookupPhone">Phone number</Label>
              <Input
                id="lookupPhone"
                type="tel"
                className="h-11 text-base"
                placeholder="(555) 123-4567"
                value={lookupPhone}
                onChange={(e) => setLookupPhone(e.target.value)}
                autoFocus
              />
              <p className="text-sm text-muted-foreground">
                A returning guest&apos;s name and email fill in automatically.
              </p>
            </div>
            <Button type="submit" className="h-12 w-full text-base" disabled={lookingUp}>
              {lookingUp ? "Looking up..." : "Continue"}
            </Button>
          </form>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground">Guest information</h3>
              {!reservation && (
                <button
                  type="button"
                  className="text-sm text-primary underline-offset-4 hover:underline"
                  onClick={() => setPhoneStep(true)}
                >
                  Use a different phone number
                </button>
              )}
            </div>
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
            <div className="space-y-2">
              <Label htmlFor="internalNote">Internal note (staff only)</Label>
              <Textarea
                id="internalNote"
                className="text-base"
                placeholder="Visible to staff only -- never shown to the guest"
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tableId">Assigned table</Label>
            <Select
              value={effectiveTableId ?? "none"}
              onValueChange={(v) => {
                setTableTouched(true);
                setTableId(v === "none" ? null : v);
              }}
            >
              <SelectTrigger id="tableId" className="h-11 w-full text-base">
                <SelectValue placeholder="No table assigned">
                  {(value: string | null) => {
                    if (!value || value === "none") return "No table assigned";
                    const t = tables.find((table) => table.id === value);
                    if (!t) return "No table assigned";
                    const recommended = value === recommendedId && !tableTouched ? " — Recommended" : "";
                    return `Table ${t.number} (seats ${t.capacity})${recommended}`;
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No table assigned</SelectItem>
                {availableTables.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    Table {t.number} (seats {t.capacity})
                    {t.id === recommendedId ? " — Recommended" : ""}
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

          <div className="flex gap-3">
            <Button type="submit" className="h-12 flex-1 text-base" disabled={saving || deleting}>
              {saving ? "Saving..." : reservation ? "Save changes" : "Confirm reservation"}
            </Button>
            {reservation && (
              <Button
                type="button"
                variant="outline"
                className="h-12 text-base text-destructive"
                disabled={saving || deleting}
                onClick={handleDelete}
              >
                {deleting ? "Deleting..." : "Delete"}
              </Button>
            )}
          </div>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
