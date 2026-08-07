"use client";

import { useEffect, useState } from "react";
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
import { updateStaffMemberAction } from "../actions";
import type { Role } from "@/generated/prisma/client";

const ROLE_OPTIONS: Role[] = ["OWNER", "STAFF"];

export type StaffMember = { id: string; name: string; email: string; role: Role; active: boolean };

export function EditStaffDialog({
  open,
  onOpenChange,
  restaurantId,
  member,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  member: StaffMember | null;
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
    const result = await updateStaffMemberAction(restaurantId, member.id, {
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
          <DialogTitle>Edit staff member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="editStaffName">Staff name</Label>
            <Input id="editStaffName" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="editStaffEmail">Email</Label>
            <Input
              id="editStaffEmail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="editStaffRole">Role</Label>
            <Select value={role} onValueChange={(v) => v && setRole(v as Role)}>
              <SelectTrigger id="editStaffRole">
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
            <Label htmlFor="editStaffPassword">New password (leave blank to keep current)</Label>
            <Input
              id="editStaffPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-base text-destructive">{error}</p>}
          <Button type="submit" className="h-12 w-full text-base" disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
