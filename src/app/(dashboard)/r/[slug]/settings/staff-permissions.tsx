"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateStaffFeatureAccessAction } from "./actions";
import type { FeatureAccess } from "@/generated/prisma/client";

export type PermissionMember = {
  id: string;
  name: string;
  reservationsAccess: FeatureAccess;
  waitlistAccess: FeatureAccess;
  floorManagerAccess: FeatureAccess;
  customersAccess: FeatureAccess;
  reportsAccess: FeatureAccess;
};

const FEATURES: { key: "reservations" | "waitlist" | "floorManager" | "customers" | "reports"; label: string; column: keyof Omit<PermissionMember, "id" | "name"> }[] = [
  { key: "reservations", label: "Reservations", column: "reservationsAccess" },
  { key: "waitlist", label: "Waiting Area", column: "waitlistAccess" },
  { key: "floorManager", label: "Floor Manager", column: "floorManagerAccess" },
  { key: "customers", label: "Customers", column: "customersAccess" },
  { key: "reports", label: "Reports", column: "reportsAccess" },
];

const ACCESS_LABELS: Record<FeatureAccess, string> = {
  NONE: "No access",
  VIEW: "View only",
  EDIT: "Can edit",
};

export function StaffPermissions({ slug, members }: { slug: string; members: PermissionMember[] }) {
  const router = useRouter();
  const [savingKey, setSavingKey] = useState<string | null>(null);

  async function handleChange(userId: string, featureKey: (typeof FEATURES)[number]["key"], value: FeatureAccess) {
    const cellKey = `${userId}:${featureKey}`;
    setSavingKey(cellKey);
    const result = await updateStaffFeatureAccessAction(slug, userId, featureKey, value);
    setSavingKey(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-[5px] border border-border">
      <div className="border-b border-border p-4">
        <h2 className="text-base font-semibold">Staff permissions</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Control which sections each staff member can view or edit. Owners always have full access.
        </p>
      </div>
      {members.length === 0 ? (
        <p className="p-6 text-center text-base text-muted-foreground">No staff members yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Staff member</TableHead>
              {FEATURES.map((f) => (
                <TableHead key={f.key}>{f.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.name}</TableCell>
                {FEATURES.map((f) => {
                  const cellKey = `${m.id}:${f.key}`;
                  const value = m[f.column];
                  return (
                    <TableCell key={f.key}>
                      <Select
                        value={value}
                        onValueChange={(v) => v && handleChange(m.id, f.key, v as FeatureAccess)}
                      >
                        <SelectTrigger className="h-9 w-36 text-sm" disabled={savingKey === cellKey}>
                          <SelectValue>{(v: FeatureAccess) => ACCESS_LABELS[v]}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NONE">No access</SelectItem>
                          <SelectItem value="VIEW">View only</SelectItem>
                          <SelectItem value="EDIT">Can edit</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
