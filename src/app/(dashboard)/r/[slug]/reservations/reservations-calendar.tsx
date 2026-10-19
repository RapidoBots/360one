"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Search, Table2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DayView, type ReservationListItem } from "./day-view";
import { WeekView } from "./week-view";
import { TimelineView } from "./timeline-view";
import { ReservationModal, type ReservationForEdit, type ReservationPrefill, type TableOption } from "./reservation-modal";
import { ReservationDetailsPanel } from "./reservation-details-panel";
import { TablesManagerDialog, type TableRow, type FloorOption } from "./tables-manager-dialog";
import { STATUS_COLORS, STATUS_LABELS } from "./reservation-badge";
import { toLocalDateInput, formatZonedDate } from "@/lib/reservation-dates";
import type { ReservationStatus } from "@/generated/prisma/client";

export type CalendarView = "day" | "week" | "timeline";

const ALL_STATUSES: ReservationStatus[] = ["PENDING", "CONFIRMED", "SEATED", "COMPLETED", "CANCELLED", "NO_SHOW"];

function shiftDateStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ReservationsCalendar({
  slug,
  view,
  date,
  reservations,
  tables,
  floors,
  dayHours,
  defaultDurationMinutes,
  timeZone,
  canEdit = true,
}: {
  slug: string;
  view: CalendarView;
  date: Date;
  reservations: ReservationListItem[];
  tables: TableRow[];
  floors: FloorOption[];
  dayHours: { isOpen: boolean; startHour: number; endHour: number };
  defaultDurationMinutes: number;
  timeZone: string;
  canEdit?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [tablesOpen, setTablesOpen] = useState(false);
  const [prefill, setPrefill] = useState<ReservationPrefill | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Record<ReservationStatus, boolean>>({
    PENDING: true,
    CONFIRMED: true,
    SEATED: true,
    COMPLETED: true,
    CANCELLED: true,
    NO_SHOW: true,
  });

  function updateParams(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  }

  const dateStr = searchParams.get("date") ?? toLocalDateInput(date, timeZone);
  const step = view === "week" ? 7 : 1;

  function goTo(nextDateStr: string, nextView?: CalendarView) {
    setEditingId(null);
    setDetailsOpen(false);
    updateParams(nextView ? { date: nextDateStr, view: nextView } : { date: nextDateStr });
  }

  const q = query.trim().toLowerCase();
  const matchesQuery = (r: ReservationListItem) =>
    !q || r.customer.name.toLowerCase().includes(q) || (r.customer.phone ?? "").toLowerCase().includes(q);
  const visible = reservations.filter((r) => filters[r.status] && matchesQuery(r));
  const active = reservations.filter((r) => r.status !== "CANCELLED");

  let dateLabel: string;
  if (view === "week") {
    const weekEnd = new Date(date.getTime() + 6 * 24 * 60 * 60 * 1000);
    dateLabel = `Week of ${formatZonedDate(date, timeZone, { month: "short", day: "numeric" })} – ${formatZonedDate(weekEnd, timeZone, { month: "short", day: "numeric" })}`;
  } else {
    dateLabel = formatZonedDate(date, timeZone, { weekday: "long", month: "long", day: "numeric" });
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
        internalNote: editing.internalNote,
        tableId: editing.tableId,
        customer: { name: editing.customer.name, email: editing.customer.email, phone: editing.customer.phone },
      }
    : undefined;

  const tableOptions: TableOption[] = tables.map((t) => ({ id: t.id, number: t.number, capacity: t.capacity }));

  function openDetails(id: string) {
    setEditingId(id);
    setDetailsOpen(true);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[32px] font-extrabold tracking-tight text-ink">Reservations</h1>
          <p className="text-[15px] text-ink-muted">
            {dateLabel} · {active.length} reservations · {active.reduce((sum, r) => sum + r.partySize, 0)} guests
          </p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2.5">
            <Button type="button" variant="outline" className="h-11 gap-2 rounded-xl px-4.5 text-sm font-semibold" onClick={() => setTablesOpen(true)}>
              <Table2 className="size-4" strokeWidth={1.8} />
              Manage tables
            </Button>
            <Button
              type="button"
              className="h-11 gap-2 rounded-xl px-5 text-sm font-bold shadow-[0_6px_16px_-6px_var(--primary)]"
              onClick={() => {
                setEditingId(null);
                setPrefill(undefined);
                setModalOpen(true);
              }}
            >
              <Plus className="size-4" strokeWidth={2.4} />
              New reservation
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 gap-y-3">
        <div role="group" aria-label="View" className="flex gap-0.5 rounded-xl bg-[#E9ECF5] p-1">
          {(["day", "week", "timeline"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => goTo(dateStr, v)}
              className={cn(
                "h-9 rounded-[9px] px-4 text-[13.5px] font-semibold capitalize transition-colors",
                view === v ? "bg-white font-bold text-ink shadow-sm" : "text-[#475569]"
              )}
            >
              {v}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={view === "week" ? "Previous week" : "Previous day"}
            onClick={() => goTo(shiftDateStr(dateStr, -step))}
            className="flex size-11 items-center justify-center rounded-xl border border-line-input bg-white text-ink hover:bg-[#F1F3F9]"
          >
            <ChevronLeft className="size-[18px]" />
          </button>
          <Input
            type="date"
            aria-label="Date"
            value={dateStr}
            onChange={(e) => e.target.value && goTo(e.target.value)}
            className="h-11 w-[160px] text-sm font-semibold"
          />
          <button
            type="button"
            aria-label={view === "week" ? "Next week" : "Next day"}
            onClick={() => goTo(shiftDateStr(dateStr, step))}
            className="flex size-11 items-center justify-center rounded-xl border border-line-input bg-white text-ink hover:bg-[#F1F3F9]"
          >
            <ChevronRight className="size-[18px]" />
          </button>
          <button
            type="button"
            onClick={() => goTo(toLocalDateInput(new Date(), timeZone))}
            className="h-11 rounded-xl border border-line-input bg-white px-4 text-[13.5px] font-semibold text-ink hover:bg-[#F1F3F9]"
          >
            Today
          </button>
        </div>

        <label className="relative ml-auto flex min-w-[200px] max-w-[340px] flex-1 basis-[240px] items-center">
          <Search className="pointer-events-none absolute left-3.5 size-[17px] text-ink-placeholder" />
          <span className="sr-only">Search reservations</span>
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search guest name or phone"
            className="h-11 w-full pl-[38px] text-sm"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        {ALL_STATUSES.map((s) => {
          const on = filters[s];
          const c = STATUS_COLORS[s];
          const count = reservations.filter((r) => r.status === s).length;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={on}
              onClick={() => setFilters((f) => ({ ...f, [s]: !f[s] }))}
              className="flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold"
              style={{
                backgroundColor: on ? c.bg : "#FFFFFF",
                color: on ? c.text : "#64748B",
                borderColor: on ? "transparent" : "#E1E5F0",
              }}
            >
              <span className="size-2 rounded-full" style={{ backgroundColor: on ? c.bar : "#CBD5E1" }} />
              {STATUS_LABELS[s]}
              <span className="font-bold opacity-80">{count}</span>
            </button>
          );
        })}
      </div>

      {view === "day" && (
        <DayView reservations={visible} totalCount={visible.length} dateLabel={dateLabel} timeZone={timeZone} onReservationClick={openDetails} />
      )}
      {view === "week" && (
        <WeekView
          reservations={visible}
          allReservations={reservations}
          weekStart={date}
          selectedDate={date}
          timeZone={timeZone}
          onDayClick={(d) => goTo(toLocalDateInput(d, timeZone), "day")}
          onReservationClick={openDetails}
        />
      )}
      {view === "timeline" && (
        <TimelineView
          reservations={visible}
          allReservations={reservations}
          tables={tables}
          date={date}
          dayHours={dayHours}
          timeZone={timeZone}
          onReservationClick={openDetails}
          onSlotClick={
            canEdit
              ? (tableId, time) => {
                  setEditingId(null);
                  setPrefill({ tableId, date: toLocalDateInput(date, timeZone), time });
                  setModalOpen(true);
                }
              : undefined
          }
        />
      )}

      {detailsOpen && editing && (
        <ReservationDetailsPanel
          slug={slug}
          reservation={editing}
          tables={tableOptions}
          timeZone={timeZone}
          canEdit={canEdit}
          onClose={() => setDetailsOpen(false)}
          onSaved={() => router.refresh()}
          onEditDetails={() => {
            setDetailsOpen(false);
            setModalOpen(true);
          }}
        />
      )}

      <ReservationModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        slug={slug}
        tables={tableOptions}
        reservations={reservations}
        reservation={editingForModal}
        prefill={prefill}
        defaultDurationMinutes={defaultDurationMinutes}
        timeZone={timeZone}
        onSaved={() => router.refresh()}
        canEdit={canEdit}
      />
      {canEdit && (
        <TablesManagerDialog
          open={tablesOpen}
          onOpenChange={setTablesOpen}
          slug={slug}
          tables={tables}
          floors={floors}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}
