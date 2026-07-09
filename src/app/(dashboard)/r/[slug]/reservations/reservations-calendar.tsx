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

  function shiftDate(days: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    updateParams({ date: toLocalDateInput(d) });
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
          <TabsList>
            <TabsTrigger value="day">Day</TabsTrigger>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => shiftDate(view === "week" ? -7 : -1)}>
            Prev
          </Button>
          <Button variant="outline" size="sm" onClick={() => updateParams({ date: toLocalDateInput(new Date()) })}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => shiftDate(view === "week" ? 7 : 1)}>
            Next
          </Button>
        </div>

        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by status">
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleStatus(s)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium",
                selectedStatuses.includes(s)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Input
            placeholder="Search guest name or phone"
            defaultValue={searchParams.get("q") ?? ""}
            className="h-9 w-56"
            onChange={(e) => updateParams({ q: e.target.value })}
          />
          <Button variant="outline" onClick={() => setTablesOpen(true)}>
            Manage tables
          </Button>
          <Button
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
