"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RestaurantStatusBadge } from "../restaurant-status-badge";
import { updateRestaurantAction, setRestaurantStatusAction } from "../actions";
import type { Role, RestaurantStatus } from "@/generated/prisma/client";

export type RestaurantWithUsers = {
  id: string;
  name: string;
  slug: string;
  status: RestaurantStatus;
  users: { id: string; name: string; email: string; role: Role }[];
};

export function RestaurantDetail({ restaurant }: { restaurant: RestaurantWithUsers }) {
  const router = useRouter();
  const [name, setName] = useState(restaurant.name);
  const [slug, setSlug] = useState(restaurant.slug);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const result = await updateRestaurantAction(restaurant.id, { name, slug });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleToggleStatus() {
    setTogglingStatus(true);
    const nextStatus: RestaurantStatus = restaurant.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    await setRestaurantStatusAction(restaurant.id, nextStatus);
    setTogglingStatus(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{restaurant.name}</h1>
          <RestaurantStatusBadge status={restaurant.status} />
        </div>
        <Button variant="outline" className="h-11 px-5 text-base" onClick={handleToggleStatus} disabled={togglingStatus}>
          {restaurant.status === "ACTIVE" ? "Suspend" : "Reactivate"}
        </Button>
      </div>

      <form onSubmit={handleSave} className="max-w-md space-y-3 rounded-[5px] border border-border p-5">
        <h2 className="text-base font-semibold">Restaurant details</h2>
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">Slug</Label>
          <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} required />
        </div>
        {error && <p className="text-base text-destructive">{error}</p>}
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save changes"}
        </Button>
      </form>
    </div>
  );
}
