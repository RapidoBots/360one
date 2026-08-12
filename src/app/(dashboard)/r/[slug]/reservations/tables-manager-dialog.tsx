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
import { createTableAction, updateTableAction, deleteTableAction } from "./actions";

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

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNumber, setEditNumber] = useState("");
  const [editCapacity, setEditCapacity] = useState(2);
  const [editArea, setEditArea] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  function startEdit(t: TableRow) {
    setEditingId(t.id);
    setEditNumber(t.number);
    setEditCapacity(t.capacity);
    setEditArea(t.area ?? "");
    setEditError(null);
  }

  async function handleEditSave(tableId: string) {
    setEditSaving(true);
    setEditError(null);
    const result = await updateTableAction(slug, tableId, {
      number: editNumber,
      capacity: editCapacity,
      area: editArea,
    });
    setEditSaving(false);
    if (!result.ok) {
      setEditError(result.error);
      return;
    }
    setEditingId(null);
    onSaved();
  }

  async function handleDelete(t: TableRow) {
    if (
      !window.confirm(
        `Delete Table ${t.number}? Any reservations assigned to it will be unassigned, not cancelled.`
      )
    )
      return;
    setDeletingId(t.id);
    setError(null);
    const result = await deleteTableAction(slug, t.id);
    setDeletingId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage tables</DialogTitle>
        </DialogHeader>

        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {tables.map((t) =>
            editingId === t.id ? (
              <li key={t.id} className="space-y-2 rounded-lg border border-border p-3">
                <div className="grid grid-cols-3 gap-2">
                  <Input aria-label="Edit table number" value={editNumber} onChange={(e) => setEditNumber(e.target.value)} />
                  <Input
                    aria-label="Edit table capacity"
                    type="number"
                    min={1}
                    value={editCapacity}
                    onChange={(e) => setEditCapacity(Number(e.target.value))}
                  />
                  <Input aria-label="Edit table area" value={editArea} onChange={(e) => setEditArea(e.target.value)} />
                </div>
                {editError && <p className="text-base text-destructive">{editError}</p>}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    className="h-9 flex-1 text-base"
                    disabled={editSaving}
                    onClick={() => handleEditSave(t.id)}
                  >
                    {editSaving ? "Saving..." : "Save"}
                  </Button>
                  <Button type="button" variant="outline" className="h-9 text-base" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </div>
              </li>
            ) : (
              <li key={t.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-base">
                <div>
                  <span>Table {t.number}{t.area ? ` · ${t.area}` : ""}</span>{" "}
                  <span className="text-muted-foreground">seats {t.capacity}</span>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="h-8 text-sm" onClick={() => startEdit(t)}>
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 text-sm text-destructive"
                    disabled={deletingId === t.id}
                    onClick={() => handleDelete(t)}
                  >
                    {deletingId === t.id ? "Deleting..." : "Delete"}
                  </Button>
                </div>
              </li>
            )
          )}
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
