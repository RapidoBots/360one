"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StaffList } from "./staff-list";
import { WeeklySchedule } from "./weekly-schedule";
import { ExchangeHistory } from "./exchange-history";
import type { Role, StaffPosition, ExchangeStatus } from "@/generated/prisma/client";

export type StaffMember = {
  id: string;
  name: string;
  email: string;
  role: Role;
  position: StaffPosition | null;
  customPosition: string | null;
  active: boolean;
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
  user: { id: string; name: string };
};

export type ExchangeData = {
  id: string;
  status: ExchangeStatus;
  note: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
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

export function StaffPageClient({
  slug,
  members,
  shifts,
  exchanges,
  weekStart,
  timezone,
}: {
  slug: string;
  members: StaffMember[];
  shifts: ShiftData[];
  exchanges: ExchangeData[];
  weekStart: string;
  timezone: string;
}) {
  const [tab, setTab] = useState<string>("schedule");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Staff</h1>
        <p className="text-sm text-muted-foreground">
          Manage your team and schedule shifts.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList variant="line">
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="exchanges">Exchanges</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" className="mt-4">
          <WeeklySchedule
            slug={slug}
            members={members.filter((m) => m.active)}
            shifts={shifts}
            weekStart={weekStart}
            timezone={timezone}
          />
        </TabsContent>

        <TabsContent value="team" className="mt-4">
          <StaffList slug={slug} members={members} />
        </TabsContent>

        <TabsContent value="exchanges" className="mt-4">
          <ExchangeHistory slug={slug} exchanges={exchanges} shifts={shifts} members={members.filter((m) => m.active)} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
