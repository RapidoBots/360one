"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { addStaffMemberAction } from "../actions";
import type { Role } from "@/generated/prisma/client";

const ROLE_OPTIONS: Role[] = ["OWNER", "STAFF"];

export function AddStaffDialog({
  open,
  onOpenChange,
  restaurantId,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  onAdded: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("STAFF");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const result = await addStaffMemberAction(restaurantId, { name, email, password, role });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setName("");
    setEmail("");
    setPassword("");
    setRole("STAFF");
    onOpenChange(false);
    onAdded();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add staff member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Labeled "Staff name" (not just "Name") -- the restaurant
              detail page behind this dialog already has its own "Name"
              field in the edit form, still in the DOM while this dialog
              is open. */}
          <div className="space-y-2">
            <Label htmlFor="staffName">Staff name</Label>
            <Input id="staffName" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="staffEmail">Email</Label>
            <Input id="staffEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="staffPassword">Password</Label>
            <Input
              id="staffPassword"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="staffRole">Role</Label>
            <NativeSelect id="staffRole" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </NativeSelect>
          </div>
          {error && <p className="text-base text-destructive">{error}</p>}
          {/* Distinct from the "Add staff member" trigger button. */}
          <Button type="submit" className="h-12 w-full text-base" disabled={saving}>
            {saving ? <><Loader2 className="mr-2 size-4 animate-spin" />Adding...</> : "Add staff"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
