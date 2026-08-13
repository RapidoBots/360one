"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  updateRestaurantProfileAction,
  uploadRestaurantLogoAction,
  uploadRestaurantBannerAction,
  type ProfileActionResult,
} from "./actions";

const TIMEZONES = Intl.supportedValuesOf("timeZone");

function ImageUploadField({
  label,
  currentUrl,
  upload,
  previewClassName,
  emptyLabel,
}: {
  label: string;
  currentUrl: string | null;
  upload: (formData: FormData) => Promise<ProfileActionResult>;
  previewClassName: string;
  emptyLabel: string;
}) {
  const [url, setUrl] = useState(currentUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const result = await upload(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // The action doesn't return the new URL, so read back the object URL
      // for an instant preview -- the real URL lands on the next server render.
      setUrl(URL.createObjectURL(file));
    } catch {
      setError("Upload failed -- please try a smaller image or try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-4">
        {url ? (
          <Image src={url} alt={label} width={128} height={64} className={previewClassName} unoptimized />
        ) : (
          <div
            className={`flex items-center justify-center rounded-[5px] border border-dashed border-border text-xs text-muted-foreground ${previewClassName}`}
          >
            {emptyLabel}
          </div>
        )}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleChange}
            disabled={uploading}
            className="text-sm"
          />
          {uploading && <p className="mt-1 text-sm text-muted-foreground">Uploading...</p>}
          {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
        </div>
      </div>
    </div>
  );
}

export function RestaurantProfileForm({
  slug,
  timezone,
  logoUrl,
  bannerUrl,
  mapsEmbedUrl,
  address,
  phone,
  notes,
  facebookUrl,
  instagramUrl,
}: {
  slug: string;
  timezone: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  mapsEmbedUrl: string | null;
  address: string | null;
  phone: string | null;
  notes: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
}) {
  const [tz, setTz] = useState(timezone);
  const [maps, setMaps] = useState(mapsEmbedUrl ?? "");
  const [addressValue, setAddressValue] = useState(address ?? "");
  const [phoneValue, setPhoneValue] = useState(phone ?? "");
  const [notesValue, setNotesValue] = useState(notes ?? "");
  const [facebookValue, setFacebookValue] = useState(facebookUrl ?? "");
  const [instagramValue, setInstagramValue] = useState(instagramUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const result = await updateRestaurantProfileAction(slug, {
        timezone: tz,
        mapsEmbedUrl: maps,
        address: addressValue,
        phone: phoneValue,
        notes: notesValue,
        facebookUrl: facebookValue,
        instagramUrl: instagramValue,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
    } catch {
      setError("Could not save -- please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 rounded-[5px] border border-border p-5">
      <h2 className="text-base font-semibold">Restaurant profile</h2>

      <ImageUploadField
        label="Logo"
        currentUrl={logoUrl}
        upload={(fd) => uploadRestaurantLogoAction(slug, fd)}
        previewClassName="size-16 rounded-[5px] border border-border object-cover"
        emptyLabel="No logo"
      />

      <ImageUploadField
        label="Banner"
        currentUrl={bannerUrl}
        upload={(fd) => uploadRestaurantBannerAction(slug, fd)}
        previewClassName="h-16 w-32 rounded-[5px] border border-border object-cover"
        emptyLabel="No banner"
      />
      <p className="text-sm text-muted-foreground">
        A wide hero image shown across the top of the reservation widget.
      </p>

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
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            className="h-11 text-base"
            placeholder="123 Main St, Toronto, ON"
            value={addressValue}
            onChange={(e) => setAddressValue(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            Shown as clickable text under the map, linking to Google Maps.
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="facebookUrl">Facebook page URL</Label>
            <Input
              id="facebookUrl"
              type="url"
              className="h-11 text-base"
              placeholder="https://facebook.com/..."
              value={facebookValue}
              onChange={(e) => setFacebookValue(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="instagramUrl">Instagram profile URL</Label>
            <Input
              id="instagramUrl"
              type="url"
              className="h-11 text-base"
              placeholder="https://instagram.com/..."
              value={instagramValue}
              onChange={(e) => setInstagramValue(e.target.value)}
            />
          </div>
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
