"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addToWaitlistAction } from "./actions";

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
    setName("");
    setPhone("");
    setEmail("");
    setPartySize(2);
    setQuotedWait("");
    setNotes("");
    setError(null);
  }, [open]);

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
          <DialogTitle>Add to waitlist</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="waitlistName">Name</Label>
            <Input
              id="waitlistName"
              className="h-11 text-base"
              placeholder="Guest name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="waitlistPhone">Phone</Label>
              <Input
                id="waitlistPhone"
                type="tel"
                className="h-11 text-base"
                placeholder="(555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
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
          {/* Distinct from the page's "Add to waitlist" trigger button --
              see Global Constraints. */}
          <Button type="submit" className="h-12 w-full text-base" disabled={saving}>
            {saving ? "Adding..." : "Add"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
