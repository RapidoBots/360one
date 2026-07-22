"use client";

import { Users, Calendar as CalendarIcon, ArrowRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const PARTY_SIZES = Array.from({ length: 10 }, (_, i) => i + 1);

export type GuestDateSelection = { partySize: number; date: string };

export function GuestDateStep({
  value,
  onChange,
  onNext,
}: {
  value: GuestDateSelection;
  onChange: (value: GuestDateSelection) => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">Please select the details below.</p>

      <div className="space-y-2">
        <Label htmlFor="widgetPartySize">Number of Guests</Label>
        <div className="relative">
          <Users className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
          <Select value={String(value.partySize)} onValueChange={(v) => onChange({ ...value, partySize: Number(v) })}>
            <SelectTrigger id="widgetPartySize" className="h-11 w-full pl-9 text-base">
              <SelectValue>{(v: string) => `${v} Guest${v === "1" ? "" : "s"}`}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PARTY_SIZES.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="widgetDate">Date</Label>
        <div className="relative">
          <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="widgetDate"
            type="date"
            className="h-11 pl-9 text-base"
            value={value.date}
            onChange={(e) => onChange({ ...value, date: e.target.value })}
          />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="button" className="h-11 gap-2 px-5 text-base" onClick={onNext}>
          Next
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
