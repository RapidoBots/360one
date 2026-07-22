"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RestaurantStatusBadge } from "./restaurant-status-badge";
import { CreateRestaurantModal } from "./create-restaurant-modal";
import type { RestaurantStatus } from "@/generated/prisma/client";

export type RestaurantListItem = {
  id: string;
  name: string;
  slug: string;
  status: RestaurantStatus;
  createdAt: Date;
  userCount: number;
};

export function RestaurantsList({ restaurants }: { restaurants: RestaurantListItem[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [modalOpen, setModalOpen] = useState(false);

  function handleSearch(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("q", value);
    else params.delete("q");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Input
          placeholder="Search by name or slug"
          defaultValue={searchParams.get("q") ?? ""}
          className="h-11 w-64 text-base"
          onChange={(e) => handleSearch(e.target.value)}
        />
        <Button className="h-11 px-5 text-base" onClick={() => setModalOpen(true)}>
          Create restaurant
        </Button>
      </div>

      {restaurants.length === 0 ? (
        <p className="py-16 text-center text-base text-muted-foreground">No restaurants yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Staff</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {restaurants.map((r) => (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => router.push(`/admin/restaurants/${r.id}`)}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.slug}</TableCell>
                <TableCell>
                  <RestaurantStatusBadge status={r.status} />
                </TableCell>
                <TableCell>{r.userCount}</TableCell>
                <TableCell>{r.createdAt.toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <CreateRestaurantModal open={modalOpen} onOpenChange={setModalOpen} onCreated={() => router.refresh()} />
    </div>
  );
}
