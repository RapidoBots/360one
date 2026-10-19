"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { setReservationStatusAction, setReservationTableAction } from "./actions";
import { formatZonedDate, formatZonedTime } from "@/lib/reservation-dates";
import { STATUS_COLORS, STATUS_LABELS } from "./reservation-badge";
import type { ReservationListItem } from "./day-view";
import type { TableOption } from "./reservation-modal";
import type { ReservationStatus } from "@/generated/prisma/client";

const NEXT_STATUS: Partial<Record<ReservationStatus, { status: ReservationStatus; label: string }>> = {
  PENDING: { status: "CONFIRMED", label: "Confirm reservation" },
  CONFIRMED: { status: "SEATED", label: "Seat guests" },
  SEATED: { status: "COMPLETED", label: "Mark completed" },
};

export function ReservationDetailsPanel({
  slug,
  reservation,
  tables,
  timeZone,
  onClose,
  onSaved,
  onEditDetails,
  canEdit = true,
}: {
  slug: string;
  reservation: ReservationListItem;
  tables: TableOption[];
  timeZone: string;
  onClose: () => void;
  onSaved: () => void;
  onEditDetails: () => void;
  canEdit?: boolean;
}) {
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const c = STATUS_COLORS[reservation.status];
  const endsAt = new Date(reservation.startsAt.getTime() + reservation.durationMinutes * 60000);
  const next = NEXT_STATUS[reservation.status];
  const canNoShow = reservation.status === "PENDING" || reservation.status === "CONFIRMED";
  const canCancel = canNoShow || reservation.status === "SEATED";

  async function changeStatus(status: ReservationStatus, key: string) {
    setSaving(key);
    setError(null);
    const result = await setReservationStatusAction(slug, reservation.id, status);
    setSaving(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved();
  }

  async function changeTable(value: string | null) {
    setSaving("table");
    setError(null);
    const result = await setReservationTableAction(slug, reservation.id, !value || value === "none" ? null : value);
    setSaving(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved();
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close reservation details"
        onClick={onClose}
        className="fixed inset-x-0 bottom-0 top-16 z-50 border-0 bg-[#0F172A]/35 p-0"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="rsvTitle"
        className="fixed right-0 top-16 bottom-0 z-50 flex w-[420px] max-w-[100vw] flex-col border-l border-line-card bg-white shadow-[-24px_0_60px_-20px_rgba(15,23,42,0.25)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line-divider px-6 py-5.5">
          <div className="flex min-w-0 flex-col gap-2.5">
            <h2 id="rsvTitle" className="text-xl font-extrabold tracking-tight text-ink">
              {reservation.customer.name}
            </h2>
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold" style={{ backgroundColor: c.bg, color: c.text }}>
              <span className="size-1.5 rounded-full" style={{ backgroundColor: c.bar }} />
              {STATUS_LABELS[reservation.status]}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close reservation details"
            className="flex size-9 shrink-0 items-center justify-center rounded-[10px] text-[#475569] hover:bg-[#F1F3F9]"
          >
            <X className="size-[18px]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-x-4 gap-y-5">
            <div>
              <p className="text-xs font-bold tracking-wider text-ink-muted uppercase">Date</p>
              <p className="mt-1 text-[15px] font-semibold text-ink">
                {formatZonedDate(reservation.startsAt, timeZone, { weekday: "short", month: "short", day: "numeric" })}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold tracking-wider text-ink-muted uppercase">Time</p>
              <p className="mt-1 text-[15px] font-semibold text-ink">
                {formatZonedTime(reservation.startsAt, timeZone)} {"–"} {formatZonedTime(endsAt, timeZone)}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold tracking-wider text-ink-muted uppercase">Party size</p>
              <p className="mt-1 text-[15px] font-semibold text-ink">
                {reservation.partySize} {reservation.partySize === 1 ? "guest" : "guests"}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold tracking-wider text-ink-muted uppercase">Phone</p>
              <p className="mt-1 text-[15px] font-semibold text-ink">{reservation.customer.phone || "—"}</p>
            </div>
          </div>

          <label className="mt-6 flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-ink">Table</span>
            <NativeSelect
              value={reservation.tableId ?? "none"}
              onChange={(e) => changeTable(e.target.value)}
              disabled={!canEdit || saving !== null}
            >
              <option value="none">Unassigned</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  Table {t.number} (seats {t.capacity})
                </option>
              ))}
            </NativeSelect>
            <span className="text-[12.5px] leading-relaxed text-ink-muted">
              Assigning a table moves the reservation out of the Unassigned row.
            </span>
          </label>

          <button type="button" onClick={onEditDetails} className="mt-4 text-sm font-semibold text-primary underline-offset-4 hover:underline">
            Edit details (date, time, party size, notes)
          </button>

          {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
        </div>

        {canEdit && (
          <div className="flex flex-wrap gap-2.5 border-t border-line-divider bg-surface-footer px-6 py-4">
            {next && (
              <Button
                type="button"
                className="h-11 flex-1 basis-[180px] text-sm font-bold"
                disabled={saving !== null}
                onClick={() => changeStatus(next.status, "primary")}
              >
                {saving === "primary" ? <Loader2 className="size-4 animate-spin" /> : next.label}
              </Button>
            )}
            {canNoShow && (
              <Button
                type="button"
                variant="outline"
                className="h-11 text-sm font-semibold"
                disabled={saving !== null}
                onClick={() => changeStatus("NO_SHOW", "noshow")}
              >
                {saving === "noshow" ? <Loader2 className="size-4 animate-spin" /> : "Mark no-show"}
              </Button>
            )}
            {canCancel && (
              <Button
                type="button"
                variant="outline"
                className="h-11 border-[#FECACA] text-sm font-semibold text-[#B91C1C] hover:bg-[#FEF2F2]"
                disabled={saving !== null}
                onClick={() => changeStatus("CANCELLED", "cancel")}
              >
                {saving === "cancel" ? <Loader2 className="size-4 animate-spin" /> : "Cancel reservation"}
              </Button>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
