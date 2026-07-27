"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateRestaurantProfileAction, uploadRestaurantLogoAction } from "./actions";

const TIMEZONES = Intl.supportedValuesOf("timeZone");

export function RestaurantProfileForm({
  slug,
  timezone,
  logoUrl,
  mapsEmbedUrl,
  phone,
  notes,
}: {
  slug: string;
  timezone: string;
  logoUrl: string | null;
  mapsEmbedUrl: string | null;
  phone: string | null;
  notes: string | null;
}) {
  const [tz, setTz] = useState(timezone);
  const [maps, setMaps] = useState(mapsEmbedUrl ?? "");
  const [phoneValue, setPhoneValue] = useState(phone ?? "");
  const [notesValue, setNotesValue] = useState(notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentLogoUrl, setCurrentLogoUrl] = useState(logoUrl);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    const result = await updateRestaurantProfileAction(slug, {
      timezone: tz,
      mapsEmbedUrl: maps,
      phone: phoneValue,
      notes: notesValue,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved(true);
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    const formData = new FormData();
    formData.set("logo", file);
    const result = await uploadRestaurantLogoAction(slug, formData);
    setUploading(false);
    if (!result.ok) {
      setUploadError(result.error);
      return;
    }
    // The action doesn't return the new URL, so read back the object URL
    // for an instant preview -- the real URL lands on the next server render.
    setCurrentLogoUrl(URL.createObjectURL(file));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="space-y-4 rounded-[5px] border border-border p-5">
      <h2 className="text-base font-semibold">Restaurant profile</h2>

      <div className="space-y-2">
        <Label>Logo</Label>
        <div className="flex items-center gap-4">
          {currentLogoUrl ? (
            <Image
              src={currentLogoUrl}
              alt="Restaurant logo"
              width={64}
              height={64}
              className="size-16 rounded-[5px] border border-border object-cover"
              unoptimized
            />
          ) : (
            <div className="flex size-16 items-center justify-center rounded-[5px] border border-dashed border-border text-xs text-muted-foreground">
              No logo
            </div>
          )}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoChange}
              disabled={uploading}
              className="text-sm"
            />
            {uploading && <p className="mt-1 text-sm text-muted-foreground">Uploading...</p>}
            {uploadError && <p className="mt-1 text-sm text-destructive">{uploadError}</p>}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="max-w-sm space-y-2">
          <Label htmlFor="timezone">Time zone</Label>
          <Select value={tz} onValueChange={(v) => v && setTz(v)}>
            <SelectTrigger id="timezone" className="h-11 w-full text-base">
              <SelectValue>{(value: string) => value}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((z) => (
                <SelectItem key={z} value={z}>
                  {z}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            Used for reservation times, business hours, and the dashboard&apos;s &quot;today&quot;.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="mapsEmbedUrl">Google Maps embed URL</Label>
          <Input
            id="mapsEmbedUrl"
            className="h-11 text-base"
            placeholder="https://www.google.com/maps/embed?..."
            value={maps}
            onChange={(e) => setMaps(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            In Google Maps, find your restaurant &rarr; Share &rarr; Embed a map &rarr; copy the URL inside{" "}
            <code>src=&quot;...&quot;</code> and paste it here.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone number</Label>
          <Input
            id="phone"
            type="tel"
            className="h-11 text-base"
            placeholder="(555) 123-4567"
            value={phoneValue}
            onChange={(e) => setPhoneValue(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">Powers the &quot;Call Now&quot; button shown to customers.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Customer-facing notes</Label>
          <Textarea
            id="notes"
            className="text-base"
            placeholder="Parking, dress code, allergy policy..."
            value={notesValue}
            onChange={(e) => setNotesValue(e.target.value)}
          />
        </div>

        {error && <p className="text-base text-destructive">{error}</p>}
        <Button type="submit" className="h-11 px-5 text-base" disabled={saving}>
          {saving ? "Saving..." : saved ? "Saved" : "Save profile"}
        </Button>
      </form>
    </div>
  );
}
