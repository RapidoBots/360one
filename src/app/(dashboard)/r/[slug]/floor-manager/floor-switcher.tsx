"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { createFloorAction, renameFloorAction, deleteFloorAction } from "./actions";
import { cn } from "@/lib/utils";

export type FloorOption = { id: string; name: string };

export function FloorSwitcher({
  slug,
  floors,
  currentFloorId,
}: {
  slug: string;
  floors: FloorOption[];
  currentFloorId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function switchFloor(floorId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("floor", floorId);
    router.push(`${pathname}?${params.toString()}`);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const result = await createFloorAction(slug, newName);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNewName("");
    setAdding(false);
    router.refresh();
  }

  async function handleRename(floorId: string) {
    setSaving(true);
    setError(null);
    const result = await renameFloorAction(slug, floorId, renameValue);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setRenamingId(null);
    router.refresh();
  }

  async function handleDelete(floor: FloorOption) {
    if (!window.confirm(`Delete "${floor.name}"? Any tables on it must be moved or deleted first.`)) return;
    setError(null);
    const result = await deleteFloorAction(slug, floor.id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (floor.id === currentFloorId) {
      const next = floors.find((f) => f.id !== floor.id);
      if (next) switchFloor(next.id);
    }
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {floors.map((floor) =>
          renamingId === floor.id ? (
            <div key={floor.id} className="flex items-center gap-1">
              <Input
                aria-label="Rename floor"
                className="h-9 w-32 text-sm"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                autoFocus
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Save floor name"
                disabled={saving}
                onClick={() => handleRename(floor.id)}
              >
                <Check className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Cancel rename"
                onClick={() => setRenamingId(null)}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ) : (
            <div
              key={floor.id}
              className="flex items-center gap-0.5 overflow-hidden rounded-[5px] border border-border"
            >
              <button
                type="button"
                onClick={() => switchFloor(floor.id)}
                className={cn(
                  "px-3.5 py-2 text-sm font-medium transition-colors",
                  floor.id === currentFloorId ? "bg-primary/10 text-primary" : "text-foreground/70 hover:bg-muted"
                )}
              >
                {floor.name}
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Rename ${floor.name}`}
                onClick={() => {
                  setRenamingId(floor.id);
                  setRenameValue(floor.name);
                }}
              >
                <Pencil className="size-3" />
              </Button>
              {floors.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive"
                  aria-label={`Delete ${floor.name}`}
                  onClick={() => handleDelete(floor)}
                >
                  <Trash2 className="size-3" />
                </Button>
              )}
            </div>
          )
        )}

        {adding ? (
          <form onSubmit={handleAdd} className="flex items-center gap-1">
            <Input
              aria-label="New floor name"
              className="h-9 w-32 text-sm"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
              required
            />
            <Button type="submit" size="icon-sm" aria-label="Save new floor" disabled={saving}>
              <Check className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Cancel add floor"
              onClick={() => {
                setAdding(false);
                setNewName("");
              }}
            >
              <X className="size-3.5" />
            </Button>
          </form>
        ) : (
          <Button type="button" variant="outline" size="icon-sm" aria-label="Add floor" onClick={() => setAdding(true)}>
            <Plus className="size-3.5" />
          </Button>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
