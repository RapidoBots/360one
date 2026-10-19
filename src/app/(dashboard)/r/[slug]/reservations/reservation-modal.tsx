"use client";

import { useEffect, useState } from "react";
import { Loader2, X, Minus, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import {
  createReservationAction,
  updateReservationAction,
  deleteReservationAction,
  findCustomerByPhoneAction,
  type ReservationInput,
} from "./actions";
import { recommendTable } from "@/lib/table-allocation";
import { toLocalDateInput, zonedDateTimeToUtc } from "@/lib/reservation-dates";
import { STATUS_COLORS, STATUS_LABELS } from "./reservation-badge";
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

const DURATION_OPTIONS = [30, 45, 60, 75, 90, 105, 120, 150, 180, 240];
const STATUS_OPTIONS: ReservationStatus[] = ["PENDING", "CONFIRMED", "SEATED", "COMPLETED", "CANCELLED", "NO_SHOW"];
const FIELD_GRID = "grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-5";

function toDateInput(d: Date, timeZone: string) {
  return toLocalDateInput(d, timeZone);
}
function toTimeInput(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function formatEndTime(time: string, durationMinutes: number): string {
  const [h, m] = time.split(":").map(Number);
  if (h === undefined || m === undefined) return "";
  const total = (h * 60 + m + durationMinutes) % 1440;
  const h24 = Math.floor(total / 60);
  const mm = total % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `Ends at ${h12}:${String(mm).padStart(2, "0")} ${period}`;
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
  canEdit = true,
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
  canEdit?: boolean;
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
  const [confirmingDelete, setConfirmingDelete] = useState(false);

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
    setConfirmingDelete(false);
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
  const nameOk = guestName.trim().length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nameOk) return;
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
      status,
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

  function clampParty(n: number) {
    setPartySize(Math.max(1, Math.min(99, n)));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-[600px] sm:max-w-[600px] flex-col gap-0 overflow-hidden rounded-[20px] p-0"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line-divider px-7 py-6">
          <div className="min-w-0">
            <DialogTitle className="m-0 text-xl font-extrabold tracking-tight text-ink">
              {phoneStep ? "New reservation" : reservation ? "Edit reservation" : "New reservation"}
            </DialogTitle>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-muted">
              {phoneStep
                ? "Look up the guest by phone to get started."
                : reservation
                  ? "Update the guest, time, table or status."
                  : "Add a reservation for a guest."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close dialog"
            className="flex size-9 shrink-0 items-center justify-center rounded-[10px] text-[#475569] hover:bg-[#F1F3F9]"
          >
            <X className="size-[18px]" />
          </button>
        </div>

        {phoneStep ? (
          <form onSubmit={handlePhoneContinue} className="flex flex-col gap-5 p-7">
            <label className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-ink">Phone number</span>
              <Input
                type="tel"
                className="h-11 text-base"
                placeholder="(555) 123-4567"
                value={lookupPhone}
                onChange={(e) => setLookupPhone(e.target.value)}
                autoFocus
              />
              <span className="text-[12.5px] leading-relaxed text-ink-muted">
                A returning guest&apos;s name and email fill in automatically.
              </span>
            </label>
            <Button type="submit" className="h-11 w-full rounded-xl text-sm font-bold" disabled={lookingUp}>
              {lookingUp ? "Looking up..." : "Continue"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <fieldset disabled={!canEdit} className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 overflow-y-auto p-7">
                {!canEdit && (
                  <p className="mb-5 rounded-xl border border-line-card bg-surface-footer px-3.5 py-2.5 text-sm text-ink-muted">
                    You have view-only access to reservations.
                  </p>
                )}

                <div className="flex flex-col gap-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-bold tracking-wider text-ink-muted uppercase">Guest</span>
                    {!reservation && (
                      <button
                        type="button"
                        className="text-[13px] font-semibold text-primary underline-offset-4 hover:underline"
                        onClick={() => setPhoneStep(true)}
                      >
                        Use a different phone number
                      </button>
                    )}
                  </div>
                  <label className="flex flex-col gap-2">
                    <span className="text-[13px] font-semibold text-ink">Name</span>
                    <Input
                      className="h-11 text-base"
                      placeholder="Guest name"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      required
                    />
                  </label>
                  <div className={FIELD_GRID}>
                    <label className="flex flex-col gap-2">
                      <span className="text-[13px] font-semibold text-ink">Email</span>
                      <Input
                        type="email"
                        className="h-11 text-base"
                        placeholder="guest@example.com"
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-[13px] font-semibold text-ink">Phone</span>
                      <Input
                        type="tel"
                        className="h-11 text-base"
                        placeholder="(555) 123-4567"
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                      />
                    </label>
                  </div>
                </div>

                <div className="mt-7 flex flex-col gap-5 border-t border-line-divider pt-7">
                  <span className="text-xs font-bold tracking-wider text-ink-muted uppercase">Reservation</span>
                  <div className={FIELD_GRID}>
                    <label className="flex flex-col gap-2">
                      <span className="text-[13px] font-semibold text-ink">Date</span>
                      <Input type="date" className="h-11 text-base" value={date} onChange={(e) => setDate(e.target.value)} required />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-[13px] font-semibold text-ink">Time</span>
                      <Input type="time" className="h-11 text-base" value={time} onChange={(e) => setTime(e.target.value)} required />
                    </label>
                    <div role="group" aria-label="Party size" className="flex flex-col gap-2">
                      <span className="text-[13px] font-semibold text-ink">Party size</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          aria-label="Decrease party size"
                          onClick={() => clampParty(partySize - 1)}
                          className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line-input bg-white text-ink hover:bg-[#F1F3F9]"
                        >
                          <Minus className="size-4" strokeWidth={2.2} />
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={99}
                          aria-label="Number of guests"
                          value={partySize}
                          onChange={(e) => clampParty(Number(e.target.value) || 1)}
                          className="h-11 min-w-0 flex-1 rounded-xl border border-line-input bg-white text-center text-[15px] font-bold text-ink outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        />
                        <button
                          type="button"
                          aria-label="Increase party size"
                          onClick={() => clampParty(partySize + 1)}
                          className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line-input bg-white text-ink hover:bg-[#F1F3F9]"
                        >
                          <Plus className="size-4" strokeWidth={2.2} />
                        </button>
                      </div>
                    </div>
                    <label className="flex flex-col gap-2">
                      <span className="text-[13px] font-semibold text-ink">Duration</span>
                      <NativeSelect value={String(durationMinutes)} onChange={(e) => setDurationMinutes(Number(e.target.value))}>
                        {DURATION_OPTIONS.map((d) => (
                          <option key={d} value={String(d)}>
                            {d} min
                          </option>
                        ))}
                      </NativeSelect>
                      <span className="text-[12.5px] leading-relaxed text-ink-muted">{formatEndTime(time, durationMinutes)}</span>
                    </label>
                  </div>

                  <label className="flex flex-col gap-2">
                    <span className="text-[13px] font-semibold text-ink">Table</span>
                    <NativeSelect
                      value={effectiveTableId ?? "none"}
                      onChange={(e) => {
                        setTableTouched(true);
                        setTableId(e.target.value === "none" ? null : e.target.value);
                      }}
                    >
                      <option value="none">No table assigned</option>
                      {availableTables.map((t) => (
                        <option key={t.id} value={t.id}>
                          Table {t.number} (seats {t.capacity})
                          {t.id === recommendedId && !tableTouched ? " — Recommended" : ""}
                        </option>
                      ))}
                    </NativeSelect>
                  </label>

                  <div role="group" aria-label="Status" className="flex flex-col gap-2">
                    <span className="text-[13px] font-semibold text-ink">Status</span>
                    <div className="flex flex-wrap gap-2">
                      {STATUS_OPTIONS.map((s) => {
                        const on = status === s;
                        const c = STATUS_COLORS[s];
                        return (
                          <button
                            key={s}
                            type="button"
                            aria-pressed={on}
                            onClick={() => setStatus(s)}
                            className="flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold"
                            style={{
                              backgroundColor: on ? c.bg : "#FFFFFF",
                              color: on ? c.text : "#64748B",
                              borderColor: on ? "transparent" : "#E1E5F0",
                            }}
                          >
                            <span className="size-2 rounded-full" style={{ backgroundColor: on ? c.bar : "#CBD5E1" }} />
                            {STATUS_LABELS[s]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="mt-7 flex flex-col gap-5 border-t border-line-divider pt-7">
                  <span className="text-xs font-bold tracking-wider text-ink-muted uppercase">Notes</span>
                  <label className="flex flex-col gap-2">
                    <span className="text-[13px] font-semibold text-ink">Special requests</span>
                    <Textarea
                      rows={3}
                      className="text-base"
                      placeholder="Allergies, seating preferences or occasion"
                      value={specialRequests}
                      onChange={(e) => setSpecialRequests(e.target.value)}
                    />
                    <span className="text-[12.5px] leading-relaxed text-ink-muted">Shown to the guest on their confirmation.</span>
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-[13px] font-semibold text-ink">Internal note</span>
                    <Textarea
                      rows={3}
                      className="text-base"
                      placeholder="Visible to staff only"
                      value={internalNote}
                      onChange={(e) => setInternalNote(e.target.value)}
                    />
                    <span className="text-[12.5px] leading-relaxed text-ink-muted">Staff only. Never shown to the guest.</span>
                  </label>
                </div>

                {error && <p className="mt-5 text-sm text-destructive">{error}</p>}
              </div>

              <div className="flex flex-wrap items-center gap-2.5 border-t border-line-divider bg-surface-footer px-7 py-4">
                {confirmingDelete ? (
                  <>
                    <span className="flex-1 basis-[220px] text-[13.5px] font-semibold text-[#B91C1C]">
                      Delete this reservation? This can&apos;t be undone.
                    </span>
                    <Button type="button" variant="outline" className="h-11 rounded-xl text-sm font-semibold" onClick={() => setConfirmingDelete(false)}>
                      Keep it
                    </Button>
                    <Button
                      type="button"
                      className="h-11 rounded-xl bg-destructive text-sm font-bold hover:bg-destructive"
                      disabled={deleting}
                      onClick={handleDelete}
                    >
                      {deleting ? <Loader2 className="size-4 animate-spin" /> : "Yes, delete"}
                    </Button>
                  </>
                ) : (
                  <>
                    {reservation && (
                      <button
                        type="button"
                        onClick={() => setConfirmingDelete(true)}
                        className="mr-auto flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-destructive hover:bg-[#FEF2F2]"
                      >
                        <Trash2 className="size-4" />
                        Delete
                      </button>
                    )}
                    <span className="flex-1" />
                    <Button type="button" variant="outline" className="h-11 rounded-xl text-sm font-semibold" onClick={() => onOpenChange(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" className="h-11 rounded-xl px-5.5 text-sm font-bold" disabled={saving || !nameOk}>
                      {saving ? (
                        <>
                          <Loader2 className="mr-2 size-4 animate-spin" />
                          Saving...
                        </>
                      ) : reservation ? (
                        "Save changes"
                      ) : (
                        "Add reservation"
                      )}
                    </Button>
                  </>
                )}
              </div>
            </fieldset>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
