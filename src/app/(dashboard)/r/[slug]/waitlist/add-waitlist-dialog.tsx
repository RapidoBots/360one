"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addToWaitlistAction } from "./actions";
import { findCustomerByPhoneAction } from "../reservations/actions";

export function AddWaitlistDialog({
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
  // Phone-first: ask for the guest's phone before anything else, so a
  // returning guest's name/email auto-fill instead of being retyped.
  const [phoneStep, setPhoneStep] = useState(true);
  const [lookingUp, setLookingUp] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [quotedWait, setQuotedWait] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) return;
    setPhoneStep(true);
    setName("");
    setPhone("");
    setEmail("");
    setPartySize(2);
    setQuotedWait("");
    setNotes("");
    setError(null);
  }, [open]);

  async function handlePhoneContinue(e: React.FormEvent) {
    e.preventDefault();
    setLookingUp(true);
    setError(null);
    const match = await findCustomerByPhoneAction(slug, phone);
    setLookingUp(false);
    setName(match?.name ?? "");
    setEmail(match?.email ?? "");
    setPhoneStep(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const result = await addToWaitlistAction(slug, {
      guestName: name,
      guestPhone: phone,
      guestEmail: email,
      partySize,
      quotedWaitMinutes: quotedWait ? Number(quotedWait) : null,
      notes,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onOpenChange(false);
    onAdded();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to Waiting Area</DialogTitle>
        </DialogHeader>

        {phoneStep ? (
          <form onSubmit={handlePhoneContinue} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="waitlistLookupPhone">Phone number</Label>
              <Input
                id="waitlistLookupPhone"
                type="tel"
                className="h-11 text-base"
                placeholder="(555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoFocus
                required
              />
              <p className="text-sm text-muted-foreground">
                A returning guest&apos;s name and email fill in automatically.
              </p>
            </div>
            <Button type="submit" className="h-11 w-full text-base" disabled={lookingUp}>
              {lookingUp ? "Looking up..." : "Continue"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="waitlistName">Name</Label>
              <button
                type="button"
                className="text-sm text-primary underline-offset-4 hover:underline"
                onClick={() => setPhoneStep(true)}
              >
                Use a different phone number
              </button>
            </div>
            <Input
              id="waitlistName"
              className="h-11 text-base"
              placeholder="Guest name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <div className="space-y-2">
              <Label htmlFor="waitlistEmail">Email</Label>
              <Input
                id="waitlistEmail"
                type="email"
                className="h-11 text-base"
                placeholder="guest@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="waitlistPartySize">Party size</Label>
                <Input
                  id="waitlistPartySize"
                  type="number"
                  min={1}
                  className="h-11 text-base"
                  value={partySize}
                  onChange={(e) => setPartySize(Number(e.target.value))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="waitlistQuotedWait">Quoted wait (min)</Label>
                <Input
                  id="waitlistQuotedWait"
                  type="number"
                  min={0}
                  className="h-11 text-base"
                  placeholder="e.g. 20"
                  value={quotedWait}
                  onChange={(e) => setQuotedWait(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="waitlistNotes">Notes (optional)</Label>
              <Textarea
                id="waitlistNotes"
                className="text-base"
                placeholder="High chair needed, prefers booth, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            {error && <p className="text-base text-destructive">{error}</p>}
            {/* Distinct from the page's "Add to Waiting Area" trigger button --
                see Global Constraints. */}
            <Button type="submit" className="h-12 w-full text-base" disabled={saving}>
              {saving ? "Adding..." : "Add"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
