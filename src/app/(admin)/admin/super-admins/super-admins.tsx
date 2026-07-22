"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddSuperAdminDialog } from "./add-super-admin-dialog";
import { setSuperAdminActiveAction } from "./actions";

export type SuperAdminItem = { id: string; name: string; email: string; active: boolean };

export function SuperAdmins({
  admins,
  currentUserId,
}: {
  admins: SuperAdminItem[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle(admin: SuperAdminItem) {
    setTogglingId(admin.id);
    setError(null);
    try {
      const result = await setSuperAdminActiveAction(admin.id, !admin.active);
      if (!result.ok) setError(result.error);
    } catch {
      // Mutation may have succeeded server-side even if this fetch was
      // aborted by the router.refresh() below racing it -- refresh
      // regardless so the UI reflects reality.
    } finally {
      setTogglingId(null);
      router.refresh();
    }
  }

  return (
    <div className="rounded-[5px] border border-border">
      <div className="flex items-center justify-between border-b border-border p-4">
        <h2 className="text-base font-semibold">Super Admins</h2>
        <Button className="h-11 px-5 text-base" onClick={() => setAddOpen(true)}>
          Add Super Admin
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {admins.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="font-medium">{a.name}</TableCell>
              <TableCell>{a.email}</TableCell>
              <TableCell>
                <Badge variant="outline">{a.active ? "Active" : "Inactive"}</Badge>
              </TableCell>
              <TableCell>
                {a.id !== currentUserId && (
                  <Button
                    variant="outline"
                    className="h-9"
                    onClick={() => handleToggle(a)}
                    disabled={togglingId === a.id}
                  >
                    {a.active ? "Deactivate" : "Reactivate"}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {error && <p className="p-4 text-base text-destructive">{error}</p>}
      <AddSuperAdminDialog open={addOpen} onOpenChange={setAddOpen} onAdded={() => router.refresh()} />
    </div>
  );
}
