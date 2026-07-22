"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RestaurantStatusBadge } from "../restaurant-status-badge";
import { updateRestaurantAction, setRestaurantStatusAction, updateGhlCredentialsAction } from "../actions";
import { AddStaffDialog } from "./add-staff-dialog";
import type { Role, RestaurantStatus } from "@/generated/prisma/client";

export type RestaurantWithUsers = {
  id: string;
  name: string;
  slug: string;
  status: RestaurantStatus;
  ghlLocationId: string | null;
  ghlApiKey: string | null;
  users: { id: string; name: string; email: string; role: Role }[];
};

export function RestaurantDetail({ restaurant }: { restaurant: RestaurantWithUsers }) {
  const router = useRouter();
  const [name, setName] = useState(restaurant.name);
  const [slug, setSlug] = useState(restaurant.slug);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const [ghlLocationId, setGhlLocationId] = useState(restaurant.ghlLocationId ?? "");
  const [ghlApiKey, setGhlApiKey] = useState(restaurant.ghlApiKey ?? "");
  const [ghlSaving, setGhlSaving] = useState(false);
  const [ghlError, setGhlError] = useState<string | null>(null);

  async function handleSaveGhl(e: React.FormEvent) {
    e.preventDefault();
    setGhlSaving(true);
    setGhlError(null);
    const result = await updateGhlCredentialsAction(restaurant.id, {
      ghlLocationId: ghlLocationId || null,
      ghlApiKey: ghlApiKey || null,
    });
    setGhlSaving(false);
    if (!result.ok) {
      setGhlError(result.error);
      return;
    }
    router.refresh();
  }

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
        <Button type="submit" className="h-11 px-5 text-base" disabled={saving}>
          {saving ? "Saving..." : "Save changes"}
        </Button>
      </form>

      <form onSubmit={handleSaveGhl} className="max-w-md space-y-3 rounded-[5px] border border-border p-5">
        <h2 className="text-base font-semibold">GoHighLevel</h2>
        <p className="text-sm text-muted-foreground">
          Connect this restaurant&apos;s GHL sub-account so new reservations sync as Contacts.
        </p>
        <div className="space-y-2">
          <Label htmlFor="ghlLocationId">Location ID</Label>
          <Input
            id="ghlLocationId"
            value={ghlLocationId}
            onChange={(e) => setGhlLocationId(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ghlApiKey">API Key</Label>
          <Input
            id="ghlApiKey"
            type="password"
            value={ghlApiKey}
            onChange={(e) => setGhlApiKey(e.target.value)}
          />
        </div>
        {ghlError && <p className="text-base text-destructive">{ghlError}</p>}
        <Button type="submit" className="h-11 px-5 text-base" disabled={ghlSaving}>
          {ghlSaving ? "Saving..." : "Save GHL settings"}
        </Button>
      </form>

      <div className="rounded-[5px] border border-border">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-base font-semibold">Staff</h2>
          <Button className="h-11 px-5 text-base" onClick={() => setAddStaffOpen(true)}>
            Add staff member
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {restaurant.users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <Badge variant="outline">{u.role}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AddStaffDialog
        open={addStaffOpen}
        onOpenChange={setAddStaffOpen}
        restaurantId={restaurant.id}
        onAdded={() => router.refresh()}
      />
    </div>
  );
}
