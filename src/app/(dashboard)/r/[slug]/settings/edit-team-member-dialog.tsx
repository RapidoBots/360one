"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateTeamMemberAction } from "./actions";
import type { Role } from "@/generated/prisma/client";
import type { TeamMember } from "./team-members";

const ROLE_OPTIONS: Role[] = ["OWNER", "STAFF"];

export function EditTeamMemberDialog({
  open,
  onOpenChange,
  slug,
  member,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  member: TeamMember | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("STAFF");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (member) {
      setName(member.name);
      setEmail(member.email);
      setRole(member.role);
      setNewPassword("");
      setError(null);
    }
  }, [member]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!member) return;
    setSaving(true);
    setError(null);
    const result = await updateTeamMemberAction(slug, member.id, {
      name,
      email,
      role,
      newPassword: newPassword || undefined,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit team member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="editTeamMemberName">Staff name</Label>
            <Input id="editTeamMemberName" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="editTeamMemberEmail">Email</Label>
            <Input
              id="editTeamMemberEmail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="editTeamMemberRole">Role</Label>
            <Select value={role} onValueChange={(v) => v && setRole(v as Role)}>
              <SelectTrigger id="editTeamMemberRole">
                <SelectValue>{(value: string) => value}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="editTeamMemberPassword">New password (leave blank to keep current)</Label>
            <Input
              id="editTeamMemberPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-base text-destructive">{error}</p>}
          <Button type="submit" className="h-12 w-full text-base" disabled={saving}>
            {saving ? <><Loader2 className="mr-2 size-4 animate-spin" />Saving...</> : "Save changes"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
