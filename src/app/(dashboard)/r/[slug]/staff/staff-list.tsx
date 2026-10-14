"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Power, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { updateStaffPositionAction, toggleStaffActiveAction, deleteStaffAction } from "./actions";
import { AddEmployeeDialog } from "./add-employee-dialog";
import { POSITION_LABELS, POSITION_COLORS } from "./constants";
import { positionLabel } from "./position-utils";
import type { StaffMember } from "./staff-page-client";
import type { StaffPosition } from "@/generated/prisma/client";

const POSITIONS: StaffPosition[] = ["SERVER", "HOST", "CHEF", "BARTENDER", "MANAGER", "OTHER"];

export function StaffList({ slug, members }: { slug: string; members: StaffMember[] }) {
  const router = useRouter();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

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

  async function handleToggleActive(m: StaffMember) {
    setTogglingId(m.id);
    const result = await toggleStaffActiveAction(slug, m.id, !m.active);
    setTogglingId(null);
    if (!result.ok) {
      toast.error(result.error);
    } else {
      toast.success(m.active ? "Employee deactivated" : "Employee activated");
      router.refresh();
    }
  }

  async function handleDelete(m: StaffMember) {
    if (!window.confirm(`Delete ${m.name}? This permanently removes their account and all shifts.`)) return;
    setDeletingId(m.id);
    const result = await deleteStaffAction(slug, m.id);
    setDeletingId(null);
    if (!result.ok) {
      toast.error(result.error);
    } else {
      toast.success("Employee deleted");
      router.refresh();
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card ring-1 ring-foreground/5">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h2 className="text-base font-semibold">Team members</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Manage employees, assign positions, and control access.
          </p>
        </div>
        <Button className="gap-2" onClick={() => setAddOpen(true)}>
          <UserPlus className="size-4" />
          Add employee
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="hidden sm:table-cell">Email</TableHead>
            <TableHead>Position</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-28" />
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
                            {positionLabel(value as StaffPosition, m.customPosition)}
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
              <TableCell>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label={m.active ? "Deactivate" : "Activate"}
                    onClick={() => handleToggleActive(m)}
                    disabled={togglingId === m.id}
                  >
                    <Power className="size-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className="text-destructive"
                    aria-label="Delete"
                    onClick={() => handleDelete(m)}
                    disabled={deletingId === m.id}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {members.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                No team members yet. Click &quot;Add employee&quot; to get started.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <AddEmployeeDialog slug={slug} open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
