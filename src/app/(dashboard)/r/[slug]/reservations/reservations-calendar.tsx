"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { DayView, type ReservationListItem } from "./day-view";
import { WeekView } from "./week-view";
import { TimelineView } from "./timeline-view";
import { ReservationModal, type ReservationForEdit, type ReservationPrefill, type TableOption } from "./reservation-modal";
import { TablesManagerDialog, type TableRow } from "./tables-manager-dialog";
import { STATUS_LABELS, STATUS_STYLES } from "./reservation-badge";
import { toLocalDateInput } from "@/lib/reservation-dates";
import type { ReservationStatus } from "@/generated/prisma/client";

export type CalendarView = "day" | "week" | "timeline";

const ALL_STATUSES: ReservationStatus[] = ["CONFIRMED", "SEATED", "COMPLETED", "CANCELLED", "NO_SHOW"];

export function ReservationsCalendar({
  slug,
  view,
  date,
  reservations,
  tables,
}: {
  slug: string;
  view: CalendarView;
  date: Date;
  reservations: ReservationListItem[];
  tables: TableRow[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tablesOpen, setTablesOpen] = useState(false);
  const [prefill, setPrefill] = useState<ReservationPrefill | undefined>(undefined);

  function updateParams(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  }

  const selectedStatuses = (searchParams.get("status") ?? "").split(",").filter(Boolean) as ReservationStatus[];

  function toggleStatus(s: ReservationStatus) {
    const next = selectedStatuses.includes(s)
      ? selectedStatuses.filter((x) => x !== s)
      : [...selectedStatuses, s];
    updateParams({ status: next.join(",") });
  }

  const editing = editingId ? reservations.find((r) => r.id === editingId) : undefined;
  const editingForModal: ReservationForEdit | undefined = editing
    ? {
        id: editing.id,
        partySize: editing.partySize,
        startsAt: editing.startsAt,
        durationMinutes: editing.durationMinutes,
        status: editing.status,
        specialRequests: editing.specialRequests,
        tableId: editing.tableId,
        customer: { name: editing.customer.name, email: editing.customer.email, phone: editing.customer.phone },
      }
    : undefined;

  const tableOptions: TableOption[] = tables.map((t) => ({ id: t.id, number: t.number, capacity: t.capacity }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={view} onValueChange={(v) => updateParams({ view: v })}>
          <TabsList className="h-11">
            <TabsTrigger value="day" className="px-4 py-2 text-base">
              Day
            </TabsTrigger>
            <TabsTrigger value="week" className="px-4 py-2 text-base">
              Week
            </TabsTrigger>
            <TabsTrigger value="timeline" className="px-4 py-2 text-base">
              Timeline
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Input
          type="date"
          value={searchParams.get("date") ?? toLocalDateInput(date)}
          onChange={(e) => updateParams({ date: e.target.value })}
          className="h-11 w-44 text-base"
          aria-label="Jump to day"
        />

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
          {ALL_STATUSES.map((s) => {
            const active = selectedStatuses.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleStatus(s)}
                className={cn(
                  "rounded-[5px] border px-3.5 py-2 text-sm font-medium transition-opacity",
                  STATUS_STYLES[s],
                  active ? "border-current" : "border-transparent opacity-50 hover:opacity-80"
                )}
              >
                {STATUS_LABELS[s]}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <Input
            placeholder="Search guest name or phone"
            defaultValue={searchParams.get("q") ?? ""}
            className="h-11 w-64 text-base"
            onChange={(e) => updateParams({ q: e.target.value })}
          />
          <Button variant="outline" className="h-11 px-5 text-base" onClick={() => setTablesOpen(true)}>
            Manage tables
          </Button>
          <Button
            className="h-11 px-5 text-base"
            onClick={() => {
              setEditingId(null);
              setPrefill(undefined);
              setModalOpen(true);
            }}
          >
            New reservation
          </Button>
        </div>
      </div>

      {view === "day" && (
        <DayView
          reservations={reservations}
          onReservationClick={(id) => {
            setEditingId(id);
            setModalOpen(true);
          }}
        />
      )}
      {view === "week" && (
        <WeekView
          reservations={reservations}
          weekStart={date}
          onDayClick={(d) => updateParams({ view: "day", date: toLocalDateInput(d) })}
          onReservationClick={(id) => {
            setEditingId(id);
            setModalOpen(true);
          }}
        />
      )}
      {view === "timeline" && (
        <TimelineView
          reservations={reservations}
          tables={tables}
          date={date}
          onReservationClick={(id) => {
            setEditingId(id);
            setModalOpen(true);
          }}
          onSlotClick={(tableId, time) => {
            setEditingId(null);
            setPrefill({ tableId, date: toLocalDateInput(date), time });
            setModalOpen(true);
          }}
        />
      )}

      <ReservationModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        slug={slug}
        tables={tableOptions}
        reservation={editingForModal}
        prefill={prefill}
        onSaved={() => router.refresh()}
      />
      <TablesManagerDialog
        open={tablesOpen}
        onOpenChange={setTablesOpen}
        slug={slug}
        tables={tables}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
