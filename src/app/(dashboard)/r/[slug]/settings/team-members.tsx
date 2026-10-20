"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Power, Trash2, Users, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SectionCard } from "@/components/ui/section-card";
import { AddTeamMemberDialog } from "./add-team-member-dialog";
import { EditTeamMemberDialog } from "./edit-team-member-dialog";
import { deleteTeamMemberAction, setTeamMemberActiveAction } from "./actions";
import type { Role } from "@/generated/prisma/client";

export type TeamMember = { id: string; name: string; email: string; role: Role; active: boolean };

const AVATAR_PALETTE: [string, string][] = [
  ["#FFF4E5", "#B45309"],
  ["#ECFDF3", "#15803D"],
  ["#FDF2F8", "#BE185D"],
  ["#F0F9FF", "#0369A1"],
];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return "?";
  const last = parts.length > 1 ? parts[parts.length - 1] : undefined;
  return ((first[0] ?? "") + (last?.[0] ?? "")).toUpperCase();
}

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
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(member: TeamMember) {
    if (!window.confirm(`Delete ${member.name}? This permanently removes their account.`)) return;
    setDeletingId(member.id);
    setError(null);
    try {
      const result = await deleteTeamMemberAction(slug, member.id);
      if (!result.ok) setError(result.error);
    } finally {
      setDeletingId(null);
      router.refresh();
    }
  }

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
    <SectionCard
      id="team"
      icon={Users}
      title="Team members"
      description="People who can sign in to this restaurant's dashboard."
      headerRight={
        <Button
          type="button"
          onClick={() => setAddOpen(true)}
          className="h-11 gap-2 rounded-xl bg-primary px-4.5 text-sm font-bold text-primary-foreground shadow-[0_6px_16px_-6px_var(--primary)] hover:bg-primary"
        >
          <Plus className="size-4" strokeWidth={2.4} />
          Add staff member
        </Button>
      }
    >
      <div className="overflow-x-auto border-t border-line-divider">
        <Table className="min-w-[680px]">
          <TableHeader>
            <TableRow className="bg-surface-footer hover:bg-surface-footer">
              <TableHead className="px-7 py-3 text-[12px] font-bold tracking-wider text-ink-muted uppercase">Name</TableHead>
              <TableHead className="px-4 py-3 text-[12px] font-bold tracking-wider text-ink-muted uppercase">Email</TableHead>
              <TableHead className="px-4 py-3 text-[12px] font-bold tracking-wider text-ink-muted uppercase">Role</TableHead>
              <TableHead className="px-4 py-3 text-[12px] font-bold tracking-wider text-ink-muted uppercase">Status</TableHead>
              <TableHead className="px-7 py-3 text-right text-[12px] font-bold tracking-wider text-ink-muted uppercase">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m, i) => {
              const owner = m.role === "OWNER";
              const [avBg, avColor] = owner
                ? ["color-mix(in srgb, var(--primary) 10%, white)", "var(--primary)"]
                : AVATAR_PALETTE[i % AVATAR_PALETTE.length]!;
              const canManage = m.id !== currentUserId;
              return (
                <TableRow key={m.id} className="border-line-divider hover:bg-[#FAFBFE]">
                  <TableCell className="px-7 py-4">
                    <div className="flex items-center gap-3">
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-full text-[12.5px] font-extrabold"
                        style={{ backgroundColor: avBg, color: avColor }}
                      >
                        {initialsOf(m.name)}
                      </span>
                      <Link href={`/r/${slug}/staff/${m.id}`} className="font-semibold text-ink hover:text-primary hover:underline">
                        {m.name}
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 text-[#475569]">{m.email}</TableCell>
                  <TableCell className="px-4 py-4">
                    <span
                      className={`inline-block rounded-full px-2.5 py-1 text-[11.5px] font-bold tracking-wide ${
                        owner ? "bg-[#EEF2FF] text-[#3730A3]" : "bg-neutral-soft text-[#334155]"
                      }`}
                    >
                      {m.role}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        m.active ? "bg-success-soft text-success" : "bg-neutral-soft text-[#475569]"
                      }`}
                    >
                      <span className={`size-1.5 rounded-full ${m.active ? "bg-[#16A34A]" : "bg-ink-placeholder"}`} />
                      {m.active ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell className="px-7 py-4">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        aria-label={`Edit ${m.name}`}
                        onClick={() => setEditingMember(m)}
                        className="flex size-9 items-center justify-center rounded-[10px] text-[#475569] hover:bg-[#F1F3F9]"
                      >
                        <Pencil className="size-[17px]" strokeWidth={1.8} />
                      </button>
                      {canManage && (
                        <>
                          <button
                            type="button"
                            aria-label={`${m.active ? "Deactivate" : "Activate"} ${m.name}`}
                            onClick={() => handleToggle(m)}
                            disabled={togglingId === m.id}
                            className="flex size-9 items-center justify-center rounded-[10px] text-[#475569] hover:bg-[#F1F3F9] disabled:opacity-60"
                          >
                            {togglingId === m.id ? (
                              <Loader2 className="size-[17px] animate-spin" />
                            ) : (
                              <Power className="size-[17px]" strokeWidth={1.8} />
                            )}
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${m.name}`}
                            onClick={() => handleDelete(m)}
                            disabled={deletingId === m.id}
                            className="flex size-9 items-center justify-center rounded-[10px] text-danger hover:bg-danger-soft disabled:opacity-60"
                          >
                            {deletingId === m.id ? (
                              <Loader2 className="size-[17px] animate-spin" />
                            ) : (
                              <Trash2 className="size-[17px]" strokeWidth={1.8} />
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {error && <p className="px-7 py-3 text-sm text-destructive">{error}</p>}
      <AddTeamMemberDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        slug={slug}
        onAdded={() => router.refresh()}
      />
      <EditTeamMemberDialog
        open={editingMember !== null}
        onOpenChange={(open) => !open && setEditingMember(null)}
        slug={slug}
        member={editingMember}
        onSaved={() => router.refresh()}
      />
    </SectionCard>
  );
}
