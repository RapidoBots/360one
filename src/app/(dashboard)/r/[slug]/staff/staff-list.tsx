"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { updateStaffPositionAction } from "./actions";
import { POSITION_LABELS, POSITION_COLORS } from "./constants";
import type { StaffMember } from "./staff-page-client";
import type { StaffPosition } from "@/generated/prisma/client";

const POSITIONS: StaffPosition[] = ["SERVER", "HOST", "CHEF", "BARTENDER", "MANAGER", "OTHER"];

export function StaffList({ slug, members }: { slug: string; members: StaffMember[] }) {
  const router = useRouter();
  const [savingId, setSavingId] = useState<string | null>(null);

  async function handlePositionChange(userId: string, value: string) {
    setSavingId(userId);
    const pos = value === "NONE" ? null : (value as StaffPosition);
    const result = await updateStaffPositionAction(slug, userId, pos);
    setSavingId(null);
    if (!result.ok) {
      toast.error(result.error);
    } else {
      toast.success("Position updated");
      router.refresh();
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card ring-1 ring-foreground/5">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-base font-semibold">Team members</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Assign positions to schedule staff on the right shifts.
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="hidden sm:table-cell">Email</TableHead>
            <TableHead>Position</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((m) => (
            <TableRow key={m.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <div
                    className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                    style={{ backgroundColor: m.position ? POSITION_COLORS[m.position] : "#94a3b8" }}
                  >
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium">{m.name}</span>
                </div>
              </TableCell>
              <TableCell className="hidden text-muted-foreground sm:table-cell">{m.email}</TableCell>
              <TableCell>
                <Select
                  value={m.position ?? "NONE"}
                  onValueChange={(v) => v && handlePositionChange(m.id, v)}
                  disabled={savingId === m.id}
                >
                  <SelectTrigger className="h-8 w-36 text-xs">
                    <SelectValue>
                      {(value: string) =>
                        value === "NONE" ? (
                          <span className="text-muted-foreground">Unassigned</span>
                        ) : (
                          <span style={{ color: POSITION_COLORS[value as StaffPosition] }}>
                            {POSITION_LABELS[value as StaffPosition]}
                          </span>
                        )
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Unassigned</SelectItem>
                    {POSITIONS.map((p) => (
                      <SelectItem key={p} value={p}>
                        <span className="flex items-center gap-2">
                          <span
                            className="inline-block size-2 rounded-full"
                            style={{ backgroundColor: POSITION_COLORS[p] }}
                          />
                          {POSITION_LABELS[p]}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Badge variant={m.active ? "default" : "outline"}>
                  {m.active ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
          {members.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="py-12 text-center text-muted-foreground">
                No team members yet. Add staff from Settings.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
