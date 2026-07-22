"use client";

import { useState } from "react";
import { User, Mail, Phone, MessageCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createWidgetReservationAction } from "./actions";
import type { ContactChannel } from "@/generated/prisma/client";

const CHANNEL_OPTIONS: ContactChannel[] = ["EMAIL", "SMS", "CALL"];
const CHANNEL_LABELS: Record<ContactChannel, string> = {
  EMAIL: "Email",
  SMS: "Text message",
  CALL: "Phone call",
};

export function ContactForm({
  slug,
  selection,
  onBack,
  onSuccess,
}: {
  slug: string;
  selection: { partySize: number; date: string; time: string };
  onBack: () => void;
  onSuccess: (booking: { partySize: number; date: string; time: string }) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [preferredContact, setPreferredContact] = useState<ContactChannel>("EMAIL");
  const [specialRequests, setSpecialRequests] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const result = await createWidgetReservationAction(slug, {
      ...selection,
      guestName: name,
      guestEmail: email,
      guestPhone: phone,
      preferredContact,
      specialRequests,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSuccess(result.booking);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">Please provide your contact information.</p>

      <div className="space-y-2">
        <Label htmlFor="widgetName">Full Name</Label>
        <div className="relative">
          <User className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="widgetName"
            className="h-11 pl-9 text-base"
            placeholder="Enter your full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="widgetEmail">Email Address</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="widgetEmail"
            type="email"
            className="h-11 pl-9 text-base"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="widgetPhone">Phone Number</Label>
        <div className="relative">
          <Phone className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="widgetPhone"
            type="tel"
            className="h-11 pl-9 text-base"
            placeholder="Enter your phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="widgetPreferredContact">Preferred Way of Communication</Label>
        <div className="relative">
          <MessageCircle className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
          <Select value={preferredContact} onValueChange={(v) => setPreferredContact(v as ContactChannel)}>
            <SelectTrigger id="widgetPreferredContact" className="h-11 w-full pl-9 text-base">
              <SelectValue>{(value: string) => CHANNEL_LABELS[value as ContactChannel]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {CHANNEL_OPTIONS.map((c) => (
                <SelectItem key={c} value={c}>
                  {CHANNEL_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="widgetSpecialRequests">Special requests (optional)</Label>
        <Textarea
          id="widgetSpecialRequests"
          className="text-base"
          placeholder="Any allergies, seating preferences, or occasion..."
          value={specialRequests}
          onChange={(e) => setSpecialRequests(e.target.value)}
        />
      </div>

      {error && <p className="text-base text-destructive">{error}</p>}

      <div className="flex justify-between pt-2">
        <Button type="button" variant="outline" className="h-11 gap-2 px-5 text-base" onClick={onBack}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <Button type="submit" className="h-11 px-6 text-base" disabled={saving}>
          {saving ? "Submitting..." : "Submit"}
        </Button>
      </div>
    </form>
  );
}
