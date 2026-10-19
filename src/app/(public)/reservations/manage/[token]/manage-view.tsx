"use client";

import { useState } from "react";
import { Loader2, Calendar, Users, MapPin, Phone, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { toLocalDateInput } from "@/lib/reservation-dates";
import {
  cancelReservationByTokenAction,
  requestRescheduleByTokenAction,
  type ManagedReservation,
} from "../actions";
import { getSlotsForDateAction } from "../../[slug]/actions";
import type { SlotAvailability } from "@/lib/widget-availability";

const PARTY_SIZES = Array.from({ length: 10 }, (_, i) => i + 1);
const EDITABLE_STATUSES = ["PENDING", "CONFIRMED", "SEATED"];

function formatDateLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
function formatTimeLabel(time: string): string {
  const [h, m] = time.split(":").map(Number) as [number, number];
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12}:00 ${ampm}` : `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

type View = "summary" | "confirmCancel" | "reschedule" | "cancelled" | "rescheduled";

export function ManageReservationView({
  token,
  reservation,
}: {
  token: string;
  reservation: ManagedReservation;
}) {
  const isEditable = EDITABLE_STATUSES.includes(reservation.status);
  const [view, setView] = useState<View>("summary");
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState(reservation.date);
  const [partySize, setPartySize] = useState(reservation.partySize);
  const [time, setTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotAvailability[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  async function loadSlots(nextDate: string, nextPartySize: number) {
    setLoadingSlots(true);
    setTime(null);
    const result = await getSlotsForDateAction(reservation.restaurant.slug, nextDate, nextPartySize);
    setSlots(result.slots);
    setLoadingSlots(false);
  }

  function openReschedule() {
    setView("reschedule");
    setError(null);
    loadSlots(date, partySize);
  }

  async function handleCancel() {
    setActing(true);
    setError(null);
    const result = await cancelReservationByTokenAction(token);
    setActing(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setView("cancelled");
  }

  async function handleRescheduleSubmit() {
    if (!time) return;
    setActing(true);
    setError(null);
    const result = await requestRescheduleByTokenAction(token, { date, time, partySize });
    setActing(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setView("rescheduled");
  }

  const todayLocal = toLocalDateInput(new Date(), reservation.restaurant.timezone);

  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-lg sm:p-8">
      <div className="mb-6 text-center">
        <p className="text-sm font-medium text-muted-foreground">{reservation.restaurant.name}</p>
        <h1 className="mt-1 text-xl font-bold">Manage your reservation</h1>
      </div>

      {view === "cancelled" ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <XCircle className="size-10 text-destructive" />
          <p className="font-semibold">Your reservation has been cancelled.</p>
          <p className="text-sm text-muted-foreground">We hope to see you another time.</p>
        </div>
      ) : view === "rescheduled" ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <CheckCircle2 className="size-10 text-primary" />
          <p className="font-semibold">Your request has been sent.</p>
          <p className="text-sm text-muted-foreground">
            We&apos;ll confirm your new time of {time && formatTimeLabel(time)} on {formatDateLabel(date)} shortly.
          </p>
        </div>
      ) : !isEditable ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <p className="font-semibold">
            {reservation.status === "CANCELLED"
              ? "This reservation has already been cancelled."
              : "This reservation has already passed."}
          </p>
          {reservation.restaurant.phone && (
            <p className="text-sm text-muted-foreground">
              Need help? Call {reservation.restaurant.name} at {reservation.restaurant.phone}.
            </p>
          )}
        </div>
      ) : view === "reschedule" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Date</label>
              <Input
                type="date"
                min={todayLocal}
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  loadSlots(e.target.value, partySize);
                }}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Party size</label>
              <NativeSelect
                value={String(partySize)}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setPartySize(n);
                  loadSlots(date, n);
                }}
              >
                {PARTY_SIZES.map((n) => (
                  <option key={n} value={String(n)}>
                    {n} guest{n === 1 ? "" : "s"}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Available times</p>
            {loadingSlots ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : slots.filter((s) => s.available).length === 0 ? (
              <p className="text-sm text-muted-foreground">No times available on this date.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {slots
                  .filter((s) => s.available)
                  .map((s) => (
                    <Button
                      key={s.time}
                      type="button"
                      variant={time === s.time ? "default" : "outline"}
                      className="h-10 text-xs"
                      onClick={() => setTime(s.time)}
                    >
                      {formatTimeLabel(s.time)}
                    </Button>
                  ))}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="h-11 flex-1" onClick={() => setView("summary")} disabled={acting}>
              Back
            </Button>
            <Button className="h-11 flex-1" onClick={handleRescheduleSubmit} disabled={!time || acting}>
              {acting ? <Loader2 className="size-4 animate-spin" /> : "Request this time"}
            </Button>
          </div>
        </div>
      ) : view === "confirmCancel" ? (
        <div className="space-y-4">
          <p className="text-sm">Are you sure you want to cancel this reservation?</p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button variant="outline" className="h-11 flex-1" onClick={() => setView("summary")} disabled={acting}>
              Never mind
            </Button>
            <Button variant="destructive" className="h-11 flex-1" onClick={handleCancel} disabled={acting}>
              {acting ? <Loader2 className="size-4 animate-spin" /> : "Yes, cancel it"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="size-4 shrink-0 text-muted-foreground" />
              <span>
                {formatDateLabel(reservation.date)} at {formatTimeLabel(reservation.time)}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Users className="size-4 shrink-0 text-muted-foreground" />
              <span>Party of {reservation.partySize}</span>
            </div>
            {reservation.restaurant.address && (
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="size-4 shrink-0 text-muted-foreground" />
                <span>{reservation.restaurant.address}</span>
              </div>
            )}
            {reservation.restaurant.phone && (
              <div className="flex items-center gap-3 text-sm">
                <Phone className="size-4 shrink-0 text-muted-foreground" />
                <span>{reservation.restaurant.phone}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Button className="h-11" onClick={openReschedule}>
              Request a different time
            </Button>
            <Button variant="outline" className="h-11 text-destructive" onClick={() => setView("confirmCancel")}>
              Cancel reservation
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
