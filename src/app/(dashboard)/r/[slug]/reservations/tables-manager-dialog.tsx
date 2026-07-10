"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTableAction } from "./actions";

export type TableRow = { id: string; number: string; capacity: number; area: string | null };

export function TablesManagerDialog({
  open,
  onOpenChange,
  slug,
  tables,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  tables: TableRow[];
  onSaved: () => void;
}) {
  const [number, setNumber] = useState("");
  const [capacity, setCapacity] = useState(2);
  const [area, setArea] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const result = await createTableAction(slug, { number, capacity, area });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNumber("");
    setCapacity(2);
    setArea("");
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage tables</DialogTitle>
        </DialogHeader>

        <ul className="max-h-48 space-y-1 overflow-y-auto">
          {tables.map((t) => (
            <li key={t.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-base">
              <span>Table {t.number}{t.area ? ` · ${t.area}` : ""}</span>
              <span className="text-muted-foreground">seats {t.capacity}</span>
            </li>
          ))}
          {tables.length === 0 && <p className="text-base text-muted-foreground">No tables yet.</p>}
        </ul>

        <form onSubmit={handleAdd} className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label htmlFor="tableNumber">Number</Label>
            <Input id="tableNumber" value={number} onChange={(e) => setNumber(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tableCapacity">Capacity</Label>
            <Input
              id="tableCapacity"
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tableArea">Area</Label>
            <Input id="tableArea" value={area} onChange={(e) => setArea(e.target.value)} />
          </div>
          {error && <p className="col-span-3 text-base text-destructive">{error}</p>}
          <Button type="submit" className="col-span-3 h-11 text-base" disabled={saving}>
            {saving ? "Adding..." : "Add table"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
