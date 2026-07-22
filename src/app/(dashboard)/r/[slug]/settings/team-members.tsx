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
import { AddTeamMemberDialog } from "./add-team-member-dialog";
import { setTeamMemberActiveAction } from "./actions";
import type { Role } from "@/generated/prisma/client";

export type TeamMember = { id: string; name: string; email: string; role: Role; active: boolean };

export function TeamMembers({
  slug,
  members,
  currentUserId,
}: {
  slug: string;
  members: TeamMember[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle(member: TeamMember) {
    setTogglingId(member.id);
    setError(null);
    try {
      const result = await setTeamMemberActiveAction(slug, member.id, !member.active);
      if (!result.ok) setError(result.error);
    } catch {
      // The mutation may still have succeeded server-side even if this
      // fetch itself was aborted (e.g. by the router.refresh() below
      // racing it) -- refresh regardless so the UI reflects reality
      // rather than getting stuck on a client-side network hiccup.
    } finally {
      setTogglingId(null);
      router.refresh();
    }
  }

  return (
    <div className="rounded-[5px] border border-border">
      <div className="flex items-center justify-between border-b border-border p-4">
        <h2 className="text-base font-semibold">Team members</h2>
        <Button className="h-11 px-5 text-base" onClick={() => setAddOpen(true)}>
          Add staff member
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="font-medium">{m.name}</TableCell>
              <TableCell>{m.email}</TableCell>
              <TableCell>
                <Badge variant="outline">{m.role}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{m.active ? "Active" : "Inactive"}</Badge>
              </TableCell>
              <TableCell>
                {m.id !== currentUserId && (
                  <Button
                    variant="outline"
                    className="h-9"
                    onClick={() => handleToggle(m)}
                    disabled={togglingId === m.id}
                  >
                    {m.active ? "Deactivate" : "Reactivate"}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {error && <p className="p-4 text-base text-destructive">{error}</p>}
      <AddTeamMemberDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        slug={slug}
        onAdded={() => router.refresh()}
      />
    </div>
  );
}
