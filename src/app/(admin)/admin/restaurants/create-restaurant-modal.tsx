"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createRestaurantAction } from "./actions";
import { slugify } from "@/lib/slugify";

export function CreateRestaurantModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) return;
    setName("");
    setSlug("");
    setSlugTouched(false);
    setOwnerEmail("");
    setOwnerPassword("");
    setError(null);
  }, [open]);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const result = await createRestaurantAction({ name, slug, ownerEmail, ownerPassword });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onOpenChange(false);
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create restaurant</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Restaurant details</h3>
            <div className="space-y-2">
              <Label htmlFor="restaurantName">Name</Label>
              <Input id="restaurantName" value={name} onChange={(e) => handleNameChange(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="restaurantSlug">Slug</Label>
              <Input
                id="restaurantSlug"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value);
                }}
                required
              />
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Owner account</h3>
            <div className="space-y-2">
              <Label htmlFor="ownerEmail">Email</Label>
              <Input id="ownerEmail" type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ownerPassword">Password</Label>
              <Input
                id="ownerPassword"
                type="password"
                value={ownerPassword}
                onChange={(e) => setOwnerPassword(e.target.value)}
                required
              />
            </div>
          </div>
          {error && <p className="text-base text-destructive">{error}</p>}
          {/* Distinct from the toolbar's "Create restaurant" trigger button
              so getByRole doesn't match both while the dialog is open. */}
          <Button type="submit" className="h-12 w-full text-base" disabled={saving}>
            {saving ? "Creating..." : "Create"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
