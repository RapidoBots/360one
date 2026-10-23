"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Loader2, Upload, ImageIcon, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { SectionCard, SectionCardBody, FieldLabel, FieldHint } from "@/components/ui/section-card";
import { cn } from "@/lib/utils";
import {
  updateRestaurantProfileAction,
  uploadRestaurantLogoAction,
  uploadRestaurantBannerAction,
  type ProfileActionResult,
} from "./actions";

const TIMEZONES = Intl.supportedValuesOf("timeZone");

const fieldClass =
  "h-11 w-full rounded-xl border-line-input bg-white px-3.5 text-sm font-medium text-ink placeholder:text-ink-placeholder focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/16";
const textareaClass =
  "w-full resize-y rounded-xl border-line-input bg-white px-3.5 py-3 text-sm font-medium text-ink placeholder:text-ink-placeholder focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/16";

function BannerUpload({
  currentUrl,
  upload,
}: {
  currentUrl: string | null;
  upload: (formData: FormData) => Promise<ProfileActionResult>;
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
      setUrl(URL.createObjectURL(file));
    } catch {
      setError("Upload failed -- please try a smaller image or try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="relative h-44 overflow-hidden rounded-2xl border-[1.5px] border-dashed border-[#BAC3E0] bg-[#EEF1FA]">
      {/* The post-upload preview swaps in a local blob: URL (see handleChange)
          before the page ever reloads -- next/image can't optimize that, so
          only the persisted Blob URL goes through the optimizer. */}
      {url && <Image src={url} alt="Banner" fill unoptimized={url.startsWith("blob:")} sizes="(min-width: 1024px) 600px, 100vw" className="object-cover" />}
      <label className="up absolute right-3 bottom-3 flex h-10 w-fit cursor-pointer items-center gap-2 rounded-xl border border-[#D5DAEA] bg-white px-4 text-[13.5px] font-semibold whitespace-nowrap text-ink shadow-[0_1px_2px_rgba(15,23,42,.06)]">
        {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {uploading ? "Uploading..." : url ? "Replace banner" : "Upload banner"}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          aria-label="Upload banner image"
          onChange={handleChange}
          disabled={uploading}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </label>
      {error && (
        <p className="absolute top-2 left-2 rounded-md bg-white/90 px-2 py-1 text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}

function LogoUpload({
  currentUrl,
  upload,
}: {
  currentUrl: string | null;
  upload: (formData: FormData) => Promise<ProfileActionResult>;
}) {
  const [url, setUrl] = useState(currentUrl);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const result = await upload(formData);
      if (result.ok) setUrl(URL.createObjectURL(file));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <label className="up absolute bottom-[-46px] left-6 flex size-24 cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-[26px] border-[1.5px] border-dashed border-[#AEB8DA] bg-white text-[12px] font-semibold text-[#475569] shadow-[0_8px_20px_-8px_rgba(15,23,42,.25)]">
      {url ? (
        <Image src={url} alt="Logo" fill unoptimized={url.startsWith("blob:")} sizes="96px" className="object-cover" />
      ) : uploading ? (
        <Loader2 className="size-[22px] animate-spin" />
      ) : (
        <>
          <ImageIcon className="size-[22px]" strokeWidth={1.8} />
          Logo
        </>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        aria-label="Upload logo"
        onChange={handleChange}
        disabled={uploading}
        className="absolute inset-0 size-full cursor-pointer opacity-0"
      />
    </label>
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
  successMessage,
  successButtonText,
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
  successMessage: string | null;
  successButtonText: string | null;
}) {
  const [tz, setTz] = useState(timezone);
  const [maps, setMaps] = useState(mapsEmbedUrl ?? "");
  const [addressValue, setAddressValue] = useState(address ?? "");
  const [phoneValue, setPhoneValue] = useState(phone ?? "");
  const [notesValue, setNotesValue] = useState(notes ?? "");
  const [facebookValue, setFacebookValue] = useState(facebookUrl ?? "");
  const [instagramValue, setInstagramValue] = useState(instagramUrl ?? "");
  const [successMessageValue, setSuccessMessageValue] = useState(successMessage ?? "");
  const [successButtonTextValue, setSuccessButtonTextValue] = useState(successButtonText ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
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
        successMessage: successMessageValue,
        successButtonText: successButtonTextValue,
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
    <SectionCard
      id="profile"
      icon={Store}
      title="Restaurant profile"
      description="What guests see on your booking widget."
      footer={
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="h-11 rounded-xl bg-primary px-5.5 text-sm font-bold text-primary-foreground shadow-[0_6px_16px_-6px_var(--primary)] hover:bg-primary"
        >
          {saving ? <><Loader2 className="mr-2 size-4 animate-spin" />Saving...</> : saved ? "Saved" : "Save profile"}
        </Button>
      }
    >
      <SectionCardBody label="Branding">
        <div className="relative mb-12">
          <BannerUpload currentUrl={bannerUrl} upload={(fd) => uploadRestaurantBannerAction(slug, fd)} />
          <LogoUpload currentUrl={logoUrl} upload={(fd) => uploadRestaurantLogoAction(slug, fd)} />
        </div>
        <FieldHint>
          The banner is a wide hero image shown across the top of the reservation widget.
        </FieldHint>
      </SectionCardBody>

      <SectionCardBody label="Location and contact">
        <div className="grid grid-cols-1 gap-5 [@media(min-width:580px)]:grid-cols-2">
          <label className="flex min-w-0 flex-col gap-2">
            <FieldLabel>Time zone</FieldLabel>
            <NativeSelect className={cn(fieldClass, "pl-3.5 pr-9")} value={tz} onChange={(e) => setTz(e.target.value)}>
              {TIMEZONES.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </NativeSelect>
            <FieldHint>Used for reservation times, business hours and the dashboard&apos;s &quot;Today&quot;.</FieldHint>
          </label>
          <label className="flex min-w-0 flex-col gap-2">
            <FieldLabel>Phone number</FieldLabel>
            <Input
              type="tel"
              className={fieldClass}
              placeholder="(555) 123-4567"
              value={phoneValue}
              onChange={(e) => setPhoneValue(e.target.value)}
            />
            <FieldHint>Powers the &quot;Call now&quot; button shown to customers.</FieldHint>
          </label>
        </div>
        <label className="flex min-w-0 flex-col gap-2">
          <FieldLabel>Address</FieldLabel>
          <Input
            type="text"
            className={fieldClass}
            placeholder="123 Main St, Toronto, ON"
            value={addressValue}
            onChange={(e) => setAddressValue(e.target.value)}
          />
          <FieldHint>Shown as clickable text under the map, linking to Google Maps.</FieldHint>
        </label>
        <label className="flex min-w-0 flex-col gap-2">
          <FieldLabel>Google Maps embed URL</FieldLabel>
          <Input
            type="url"
            className={fieldClass}
            placeholder="https://www.google.com/maps/embed?..."
            value={maps}
            onChange={(e) => setMaps(e.target.value)}
          />
          <FieldHint>
            In Google Maps, find your restaurant, then Share, Embed a map. Copy the URL inside{" "}
            <code className="rounded-md bg-[#F1F3F9] px-1.5 py-px font-mono text-[#334155]">src=&quot;...&quot;</code> and paste it
            here.
          </FieldHint>
        </label>
      </SectionCardBody>

      <SectionCardBody label="Social profiles">
        <div className="grid grid-cols-1 gap-5 [@media(min-width:580px)]:grid-cols-2">
          <label className="flex min-w-0 flex-col gap-2">
            <FieldLabel>Facebook page URL</FieldLabel>
            <Input
              type="url"
              className={fieldClass}
              placeholder="https://facebook.com/..."
              value={facebookValue}
              onChange={(e) => setFacebookValue(e.target.value)}
            />
          </label>
          <label className="flex min-w-0 flex-col gap-2">
            <FieldLabel>Instagram profile URL</FieldLabel>
            <Input
              type="url"
              className={fieldClass}
              placeholder="https://instagram.com/..."
              value={instagramValue}
              onChange={(e) => setInstagramValue(e.target.value)}
            />
          </label>
        </div>
      </SectionCardBody>

      <SectionCardBody label="Guest messages">
        <label className="flex min-w-0 flex-col gap-2">
          <FieldLabel>Customer-facing notes</FieldLabel>
          <Textarea
            rows={3}
            className={textareaClass}
            placeholder="Parking, dress code, allergy policy..."
            value={notesValue}
            onChange={(e) => setNotesValue(e.target.value)}
          />
        </label>
        <label className="flex min-w-0 flex-col gap-2">
          <FieldLabel>Widget confirmation message</FieldLabel>
          <Textarea
            rows={3}
            className={textareaClass}
            placeholder="Your request has been sent to {restaurant_name}. We'll notify you once confirmed."
            value={successMessageValue}
            onChange={(e) => setSuccessMessageValue(e.target.value)}
          />
          <FieldHint>
            Shown to guests right after they submit a booking. Use{" "}
            <code className="rounded-md bg-[#F1F3F9] px-1.5 py-px font-mono text-[#334155]">{"{restaurant_name}"}</code>,{" "}
            <code className="rounded-md bg-[#F1F3F9] px-1.5 py-px font-mono text-[#334155]">{"{date}"}</code> and{" "}
            <code className="rounded-md bg-[#F1F3F9] px-1.5 py-px font-mono text-[#334155]">{"{time}"}</code> wherever you
            want them inserted. Leave blank to use the default English text.
          </FieldHint>
        </label>
        <label className="flex min-w-0 flex-col gap-2">
          <FieldLabel>Widget confirmation button text</FieldLabel>
          <Input
            type="text"
            className={fieldClass}
            placeholder="Book another reservation"
            value={successButtonTextValue}
            onChange={(e) => setSuccessButtonTextValue(e.target.value)}
          />
          <FieldHint>The button below the confirmation message. Leave blank for the default.</FieldHint>
        </label>
      </SectionCardBody>

      {error && <p className="px-7 pb-2 text-sm text-destructive">{error}</p>}
    </SectionCard>
  );
}
