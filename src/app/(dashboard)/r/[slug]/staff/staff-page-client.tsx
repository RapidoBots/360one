"use client";

import { useState } from "react";
import {
  LayoutGrid, CalendarDays, Users, ClipboardList, ArrowRightLeft,
  Calendar, Clock, AlertTriangle,
} from "lucide-react";
import { WeeklySchedule } from "./weekly-schedule";
import { TimeOffRequests } from "./time-off-requests";
import { ExchangeHistory } from "./exchange-history";
import { AddEmployeeDialog } from "./add-employee-dialog";
import { positionLabel } from "./position-utils";
import type { Role, StaffPosition, ExchangeStatus, TimeOffStatus } from "@/generated/prisma/client";

export type StaffMember = {
  id: string;
  name: string;
  email: string;
  role: Role;
  position: StaffPosition | null;
  customPosition: string | null;
  active: boolean;
  availabilityOff: number[];
};

export type ShiftData = {
  id: string;
  userId: string;
  date: string;
  startTime: string;
  endTime: string;
  position: StaffPosition;
  customPosition: string | null;
  notes: string | null;
  draft: boolean;
  user: { id: string; name: string };
};

export type ExchangeData = {
  id: string;
  status: ExchangeStatus;
  note: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
  requesterUserId: string | null;
  requesterUserName: string | null;
  targetUserId: string | null;
  targetUserName: string | null;
  requesterShift: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    position: StaffPosition;
    customPosition: string | null;
    user: { id: string; name: string };
  };
  targetShift: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    position: StaffPosition;
    customPosition: string | null;
    user: { id: string; name: string };
  };
};

export type TimeOffRequestData = {
  id: string;
  userId: string;
  fromDate: string;
  toDate: string;
  reason: string | null;
  status: TimeOffStatus;
  reviewedAt: Date | null;
  createdAt: Date;
  user: { id: string; name: string };
};

type SubPage = "overview" | "schedule" | "team" | "requests" | "exchanges" | "my" | "myrequests" | "myexchanges";

const OWNER_NAV: { key: SubPage; label: string; icon: typeof LayoutGrid }[] = [
  { key: "overview", label: "Overview", icon: LayoutGrid },
  { key: "schedule", label: "Schedule", icon: CalendarDays },
  { key: "team", label: "Team", icon: Users },
  { key: "exchanges", label: "Exchanges", icon: ArrowRightLeft },
  { key: "requests", label: "Requests", icon: ClipboardList },
];

const STAFF_NAV: { key: SubPage; label: string; icon: typeof LayoutGrid }[] = [
  { key: "my", label: "My Shifts", icon: CalendarDays },
  { key: "myexchanges", label: "Exchanges", icon: ArrowRightLeft },
  { key: "myrequests", label: "My Requests", icon: ClipboardList },
];

export function StaffPageClient({
  slug,
  members,
  shifts,
  exchanges,
  timeOffRequests,
  weekStart,
  timezone,
  currentUserId,
  currentUserRole,
  initialTab,
}: {
  slug: string;
  members: StaffMember[];
  shifts: ShiftData[];
  exchanges: ExchangeData[];
  timeOffRequests: TimeOffRequestData[];
  weekStart: string;
  timezone: string;
  currentUserId: string;
  currentUserRole: Role;
  initialTab?: string;
}) {
  const isOwner = currentUserRole === "OWNER" || currentUserRole === "SUPER_ADMIN";
  const navItems = isOwner ? OWNER_NAV : STAFF_NAV;
  const defaultPage: SubPage = isOwner ? "schedule" : "my";

  const [page, setPage] = useState<SubPage>(
    (initialTab as SubPage) || defaultPage
  );

  const visibleShifts = isOwner ? shifts : shifts.filter((s) => !s.draft);
  const myRequests = isOwner
    ? timeOffRequests
    : timeOffRequests.filter((r) => r.userId === currentUserId);

  const pendingRequests = (isOwner ? timeOffRequests : myRequests).filter((r) => r.status === "PENDING").length;
  const pendingExchanges = isOwner
    ? exchanges.filter((e) => e.status === "PENDING").length
    : exchanges.filter((e) => e.status === "PENDING" && e.targetShift.user.id === currentUserId).length;
  const activeMembers = members.filter((m) => m.active);
  const scheduledCount = new Set(visibleShifts.map((s) => s.userId)).size;
  const totalHours = visibleShifts.reduce((sum, s) => sum + shiftDuration(s), 0);
  const draftCount = shifts.filter((s) => s.draft).length;

  const pageTitle: Record<SubPage, string> = {
    overview: "Ready for today.",
    schedule: "A clearer week.",
    team: "Your people.",
    exchanges: "Shift exchanges.",
    requests: "Time-off requests.",
    my: "Your next service.",
    myexchanges: "Shift swaps.",
    myrequests: "Your requests.",
  };
  const pageDesc: Record<SubPage, string> = {
    overview: "Overview of your team's schedule and upcoming shifts.",
    schedule: "Plan your shifts. Support your team. Be ready for service.",
    team: "Manage employees, assign positions, and control access.",
    exchanges: "Review and manage shift swap requests between team members.",
    requests: "Review time off and keep your schedule in sync.",
    my: "Your upcoming published shifts.",
    myexchanges: "Request swaps and respond to incoming exchange requests.",
    myrequests: "Track your time-off requests.",
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <p className="text-xs font-bold tracking-[0.1em] text-primary">STAFF SCHEDULING</p>
        <h1 className="mt-1 text-[28px] font-extrabold leading-tight tracking-tight">
          {pageTitle[page]}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {pageDesc[page]}
        </p>
      </div>

      {/* Sub-page navigation */}
      <nav className="flex gap-1 rounded-lg bg-muted/50 p-1">
        {navItems.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setPage(key)}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              page === key
                ? "bg-background text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="size-4" />
            {label}
            {(key === "exchanges" || key === "myexchanges") && pendingExchanges > 0 && (
              <span className="ml-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                {pendingExchanges}
              </span>
            )}
            {(key === "requests" || key === "myrequests") && pendingRequests > 0 && (
              <span className="ml-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                {pendingRequests}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Stats cards — owner views */}
      {isOwner && (page === "overview" || page === "schedule") && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Team scheduled"
            value={scheduledCount}
            note={`of ${activeMembers.length} team members`}
            icon={<Users className="size-4" />}
          />
          <StatCard
            label="Scheduled hours"
            value={`${Math.round(totalHours * 10) / 10}`}
            suffix="hrs"
            note="After unpaid breaks"
            icon={<Clock className="size-4" />}
          />
          <StatCard
            label="Total shifts"
            value={visibleShifts.length}
            note="Across this week"
            icon={<Calendar className="size-4" />}
          />
          <StatCard
            label="Draft shifts"
            value={draftCount}
            note={draftCount ? "Publish to make visible" : "All shifts published"}
            icon={<AlertTriangle className="size-4" />}
          />
        </div>
      )}

      {/* Sub-page content */}
      {page === "overview" && (
        <OverviewPage
          shifts={visibleShifts}
          timeOffRequests={timeOffRequests}
          members={activeMembers}
          onGoToSchedule={() => setPage("schedule")}
          onGoToRequests={() => setPage("requests")}
          draftCount={draftCount}
        />
      )}
      {page === "schedule" && (
        <WeeklySchedule
          slug={slug}
          members={activeMembers}
          shifts={visibleShifts}
          weekStart={weekStart}
          timezone={timezone}
          isOwner={isOwner}
        />
      )}
      {page === "team" && (
        <TeamCards
          slug={slug}
          members={members}
          shifts={visibleShifts}
          isOwner={isOwner}
        />
      )}
      {page === "exchanges" && (
        <ExchangeHistory
          slug={slug}
          exchanges={exchanges}
          shifts={visibleShifts}
          members={activeMembers}
          currentUserId={currentUserId}
        />
      )}
      {page === "requests" && (
        <TimeOffRequests
          slug={slug}
          requests={timeOffRequests}
          isOwner={isOwner}
        />
      )}
      {page === "myexchanges" && (
        <ExchangeHistory
          slug={slug}
          exchanges={exchanges}
          shifts={visibleShifts}
          members={activeMembers}
          currentUserId={currentUserId}
          isStaffView
        />
      )}
      {page === "my" && (
        <MySchedule
          shifts={visibleShifts}
          currentUserId={currentUserId}
          members={activeMembers}
        />
      )}
      {page === "myrequests" && (
        <TimeOffRequests
          slug={slug}
          requests={myRequests}
          isOwner={false}
        />
      )}
    </div>
  );
}

function StatCard({
  label, value, suffix, note, icon,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  note: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        {label}
        <span className="text-muted-foreground/60">{icon}</span>
      </div>
      <div className="mt-2 text-2xl font-extrabold tracking-tight">
        {value}
        {suffix && <span className="ml-1 text-xs font-medium tracking-normal text-muted-foreground">{suffix}</span>}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function OverviewPage({
  shifts, timeOffRequests, members, onGoToSchedule, onGoToRequests, draftCount,
}: {
  shifts: ShiftData[];
  timeOffRequests: TimeOffRequestData[];
  members: StaffMember[];
  onGoToSchedule: () => void;
  onGoToRequests: () => void;
  draftCount: number;
}) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayShifts = shifts.filter((s) => s.date === todayStr && !s.draft);
  const pending = timeOffRequests.filter((r) => r.status === "PENDING");
  const publishedCount = shifts.filter((s) => !s.draft).length;
  const total = shifts.length;

  return (
    <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
      {/* Time-off requests summary */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            Time-off requests{" "}
            {pending.length > 0 && (
              <span className="ml-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                {pending.length}
              </span>
            )}
          </h3>
          <button onClick={onGoToRequests} className="text-xs font-medium text-primary hover:underline">
            View requests &rarr;
          </button>
        </div>
        <div className="mt-4 space-y-0 divide-y divide-border">
          {pending.slice(0, 3).map((r) => (
            <div key={r.id} className="flex items-center gap-3 py-3">
              <Avatar name={r.user.name} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{r.user.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(r.fromDate)}
                  {r.toDate !== r.fromDate && ` – ${formatDate(r.toDate)}`}
                  {r.reason && ` · ${r.reason}`}
                </p>
              </div>
              <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                Pending
              </span>
            </div>
          ))}
          {pending.length === 0 && (
            <p className="py-4 text-sm text-muted-foreground">You&apos;re all caught up.</p>
          )}
        </div>
      </div>

      {/* Publish status */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Before you publish</h3>
          <Calendar className="size-4 text-muted-foreground" />
        </div>
        <div className="mt-4 flex gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {draftCount > 0 ? <AlertTriangle className="size-4" /> : <CalendarDays className="size-4" />}
          </div>
          <div>
            <p className="text-sm font-semibold">
              {draftCount > 0 ? "Draft shifts need publishing." : "Your week is looking good."}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {draftCount > 0
                ? "Review your draft shifts, then publish to make the latest schedule visible to your team."
                : "Your team can see the published shifts. Any new edits will stay in draft until you publish again."}
            </p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-4">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: total ? `${(publishedCount / total) * 100}%` : "0%" }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>{publishedCount} published</span>
            <span>{draftCount} draft</span>
          </div>
        </div>

        {todayShifts.length > 0 && (
          <div className="mt-5 border-t border-border pt-4">
            <h4 className="text-xs font-semibold text-muted-foreground">TODAY&apos;S TEAM</h4>
            <div className="mt-2 space-y-2">
              {todayShifts.slice(0, 4).map((s) => (
                <div key={s.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Avatar name={s.user.name} size="sm" />
                    <span className="font-medium">{s.user.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{s.startTime}–{s.endTime}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={onGoToSchedule}
          className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Open schedule &rarr;
        </button>
      </div>
    </div>
  );
}

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const sizeClass = size === "sm" ? "size-7 text-[10px]" : "size-8 text-xs";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary ${sizeClass}`}
    >
      {initials}
    </span>
  );
}

function TeamCards({
  slug, members, shifts, isOwner,
}: {
  slug: string;
  members: StaffMember[];
  shifts: ShiftData[];
  isOwner: boolean;
}) {
  const [addOpen, setAddOpen] = useState(false);

  function memberHours(id: string): number {
    return shifts
      .filter((s) => s.userId === id)
      .reduce((sum, s) => sum + shiftDuration(s), 0);
  }

  return (
    <>
      {isOwner && (
        <div className="mb-5 flex justify-end">
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Users className="size-4" />
            Add employee
          </button>
        </div>
      )}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((m) => {
          const hrs = Math.round(memberHours(m.id) * 10) / 10;
          const isDark = m.position === "CHEF";
          const initials = m.name
            .split(" ")
            .map((w) => w[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();

          return (
            <div
              key={m.id}
              className="rounded-xl border border-border bg-card p-5"
            >
              <span
                className={`inline-flex size-11 items-center justify-center rounded-full text-xs font-bold ${
                  isDark
                    ? "bg-[#20242d] text-white"
                    : "bg-primary/10 text-primary"
                }`}
              >
                {initials}
              </span>
              <h3 className="mt-4 text-lg font-bold tracking-tight">{m.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {m.position ? positionLabel(m.position, m.customPosition) : "Unassigned"}
                {" · "}
                {m.active ? "Active" : "Inactive"}
              </p>
              <div className="mt-5 flex items-center justify-between border-t border-border pt-5 text-sm">
                <span>{hrs} hrs scheduled</span>
                <span className="text-xs font-medium text-primary">
                  Availability &rarr;
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {members.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No team members yet. Click &quot;Add employee&quot; to get started.
        </p>
      )}
      {isOwner && (
        <AddEmployeeDialog slug={slug} open={addOpen} onOpenChange={setAddOpen} />
      )}
    </>
  );
}

function MySchedule({
  shifts, currentUserId, members,
}: {
  shifts: ShiftData[];
  currentUserId: string;
  members: StaffMember[];
}) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const myShifts = shifts
    .filter((s) => s.userId === currentUserId && s.date >= todayStr)
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
  const me = members.find((m) => m.id === currentUserId);

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h3 className="text-sm font-semibold">Published shifts</h3>
        <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
          {myShifts.length} upcoming
        </span>
      </div>
      <div className="divide-y divide-border">
        {myShifts.map((s) => {
          const d = new Date(s.date + "T12:00:00Z");
          return (
            <div key={s.id} className="flex items-center gap-5 px-5 py-4">
              <div className="flex flex-col items-center rounded-lg bg-primary/10 px-4 py-3 text-primary">
                <span className="text-xs">{d.toLocaleDateString("en-CA", { weekday: "short", timeZone: "UTC" })}</span>
                <span className="text-xl font-bold">{d.getUTCDate()}</span>
              </div>
              <div>
                <p className="text-base font-bold">{s.startTime} – {s.endTime}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {positionLabel(s.position, s.customPosition)}
                  {s.notes && ` · ${s.notes}`}
                </p>
              </div>
            </div>
          );
        })}
        {myShifts.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No upcoming published shifts. Your manager will publish the next schedule here.
          </p>
        )}
      </div>
    </div>
  );
}

function shiftDuration(s: ShiftData): number {
  const [sh, sm] = s.startTime.split(":").map(Number);
  const [eh, em] = s.endTime.split(":").map(Number);
  let mins = (eh! * 60 + em!) - (sh! * 60 + sm!);
  if (mins <= 0) mins += 1440;
  return mins / 60;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "UTC" });
}
