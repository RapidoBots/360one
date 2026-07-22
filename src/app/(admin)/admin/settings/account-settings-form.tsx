"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export function AccountSettingsForm({ currentEmail }: { currentEmail: string }) {
  const router = useRouter();

  const [newEmail, setNewEmail] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSaved, setEmailSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEmailSaving(true);
    setEmailError(null);
    setEmailSaved(false);
    const { error } = await authClient.changeEmail({ newEmail });
    setEmailSaving(false);
    if (error) {
      setEmailError(error.message ?? "Could not update email.");
      return;
    }
    setNewEmail("");
    setEmailSaved(true);
    router.refresh();
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordSaving(true);
    setPasswordError(null);
    setPasswordSaved(false);
    const { error } = await authClient.changePassword({ currentPassword, newPassword });
    setPasswordSaving(false);
    if (error) {
      setPasswordError(error.message ?? "Could not update password.");
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setPasswordSaved(true);
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <form onSubmit={handleEmailSubmit} className="space-y-4 rounded-[5px] border border-border p-4">
        <h2 className="text-base font-semibold">Login email</h2>
        <div className="space-y-2">
          <Label htmlFor="currentEmail">Current email</Label>
          <Input id="currentEmail" value={currentEmail} disabled />
        </div>
        <div className="space-y-2">
          <Label htmlFor="newEmail">New email</Label>
          <Input
            id="newEmail"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
          />
        </div>
        {emailError && <p className="text-base text-destructive">{emailError}</p>}
        {emailSaved && <p className="text-base text-muted-foreground">Email updated.</p>}
        <Button type="submit" className="h-11 w-full text-base" disabled={emailSaving}>
          {emailSaving ? "Updating..." : "Update email"}
        </Button>
      </form>

      <form onSubmit={handlePasswordSubmit} className="space-y-4 rounded-[5px] border border-border p-4">
        <h2 className="text-base font-semibold">Password</h2>
        <div className="space-y-2">
          <Label htmlFor="currentPassword">Current password</Label>
          <Input
            id="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="newPassword">New password</Label>
          <Input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
        </div>
        {passwordError && <p className="text-base text-destructive">{passwordError}</p>}
        {passwordSaved && <p className="text-base text-muted-foreground">Password updated.</p>}
        <Button type="submit" className="h-11 w-full text-base" disabled={passwordSaving}>
          {passwordSaving ? "Updating..." : "Update password"}
        </Button>
      </form>
    </div>
  );
}
