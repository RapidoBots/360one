"use client";

import { useState } from "react";
import { Loader2, Eye, EyeOff, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldLabel, FieldHint } from "@/components/ui/section-card";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { addTeamMemberAction } from "./actions";
import type { Role } from "@/generated/prisma/client";

const ROLE_OPTIONS: Role[] = ["OWNER", "STAFF"];

const fieldClass =
  "h-11 w-full rounded-xl border-line-input bg-white px-3.5 text-sm font-medium text-ink focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/16";

export function AddTeamMemberDialog({
  open,
  onOpenChange,
  slug,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  onAdded: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("STAFF");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const cantSave = !name.trim() || !email.trim() || !password.trim();

  async function handleSubmit() {
    if (cantSave) return;
    setSaving(true);
    setError(null);
    const result = await addTeamMemberAction(slug, { name, email, password, role });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setName("");
    setEmail("");
    setPassword("");
    setRole("STAFF");
    setShowPw(false);
    onOpenChange(false);
    onAdded();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-[480px] sm:max-w-[480px] gap-0 rounded-[20px] p-0">
        <div className="flex items-center justify-between gap-3 border-b border-line-divider px-6 py-5.5">
          <DialogTitle className="text-lg font-bold tracking-tight text-ink">Add team member</DialogTitle>
          <button
            type="button"
            aria-label="Close dialog"
            onClick={() => onOpenChange(false)}
            className="flex size-9 items-center justify-center rounded-[10px] text-[#475569] hover:bg-[#F1F3F9]"
          >
            <X className="size-[18px]" />
          </button>
        </div>
        <div className="flex flex-col gap-5 p-6">
          <label className="flex flex-col gap-2">
            <FieldLabel>Staff name</FieldLabel>
            <Input value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
          </label>
          <label className="flex flex-col gap-2">
            <FieldLabel>Email</FieldLabel>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={fieldClass} />
          </label>
          <label className="flex flex-col gap-2">
            <FieldLabel>Role</FieldLabel>
            <NativeSelect className={cn(fieldClass, "pl-3.5 pr-9")} value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="flex flex-col gap-2">
            <FieldLabel>Password</FieldLabel>
            <div className="relative flex items-center">
              <Input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className={`${fieldClass} pr-11`}
              />
              <button
                type="button"
                aria-label={showPw ? "Hide password" : "Show password"}
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-1.5 flex size-9 items-center justify-center rounded-[10px] text-[#475569] hover:bg-[#F1F3F9]"
              >
                {showPw ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
              </button>
            </div>
            <FieldHint>Staff use this to sign in.</FieldHint>
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <div className="flex justify-end gap-2.5 rounded-b-[20px] border-t border-line-divider bg-surface-footer px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-11 rounded-xl border-[#D5DAEA] px-5 text-sm font-semibold text-ink"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={cantSave || saving}
            className="h-11 rounded-xl bg-primary px-5.5 text-sm font-bold text-primary-foreground shadow-[0_6px_16px_-6px_var(--primary)] hover:bg-primary disabled:opacity-50"
          >
            {saving ? <><Loader2 className="mr-2 size-4 animate-spin" />Adding...</> : "Add member"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
