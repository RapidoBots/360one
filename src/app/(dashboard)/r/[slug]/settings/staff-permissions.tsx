"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, Check } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NativeSelect } from "@/components/ui/native-select";
import { SectionCard } from "@/components/ui/section-card";
import { Button } from "@/components/ui/button";
import { updateStaffFeatureAccessAction } from "./actions";
import type { FeatureAccess } from "@/generated/prisma/client";

export type PermissionMember = {
  id: string;
  name: string;
  reservationsAccess: FeatureAccess;
  waitlistAccess: FeatureAccess;
  floorManagerAccess: FeatureAccess;
  customersAccess: FeatureAccess;
  reportsAccess: FeatureAccess;
};

type FeatureKey = "reservations" | "waitlist" | "floorManager" | "customers" | "reports";

const FEATURES: { key: FeatureKey; label: string; column: keyof Omit<PermissionMember, "id" | "name"> }[] = [
  { key: "reservations", label: "Reservations", column: "reservationsAccess" },
  { key: "waitlist", label: "Waiting Area", column: "waitlistAccess" },
  { key: "floorManager", label: "Floor Manager", column: "floorManagerAccess" },
  { key: "customers", label: "Customers", column: "customersAccess" },
  { key: "reports", label: "Reports", column: "reportsAccess" },
];

const ACCESS_LABELS: Record<FeatureAccess, string> = {
  NONE: "No access",
  VIEW: "View only",
  EDIT: "Can edit",
};

const ACCESS_STYLE: Record<FeatureAccess, { bg: string; color: string; border: string }> = {
  NONE: { bg: "var(--neutral-soft)", color: "var(--neutral)", border: "#E2E8F0" },
  VIEW: { bg: "var(--warning-soft)", color: "var(--warning)", border: "#FDE68A" },
  EDIT: { bg: "var(--success-soft)", color: "var(--success)", border: "#BBF7D0" },
};

const AVATAR_PALETTE: [string, string][] = [
  ["#FFF4E5", "#B45309"],
  ["#ECFDF3", "#15803D"],
  ["#FDF2F8", "#BE185D"],
  ["#F0F9FF", "#0369A1"],
];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return "?";
  const last = parts.length > 1 ? parts[parts.length - 1] : undefined;
  return ((first[0] ?? "") + (last?.[0] ?? "")).toUpperCase();
}

export function StaffPermissions({
  slug,
  members,
  owner,
}: {
  slug: string;
  members: PermissionMember[];
  owner: { name: string };
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Record<string, Partial<Record<FeatureKey, FeatureAccess>>>>({});
  const [saving, setSaving] = useState(false);

  function valueFor(m: PermissionMember, f: (typeof FEATURES)[number]): FeatureAccess {
    return pending[m.id]?.[f.key] ?? m[f.column];
  }

  function setPendingValue(userId: string, featureKey: FeatureKey, value: FeatureAccess) {
    const member = members.find((m) => m.id === userId);
    const column = FEATURES.find((f) => f.key === featureKey)?.column;
    const original = member && column ? member[column] : undefined;
    setPending((prev) => {
      const next = { ...prev[userId] };
      if (value === original) {
        delete next[featureKey];
      } else {
        next[featureKey] = value;
      }
      return { ...prev, [userId]: next };
    });
  }

  const dirtyCount = Object.values(pending).reduce((n, byFeature) => n + Object.keys(byFeature).length, 0);

  async function handleSave() {
    setSaving(true);
    const calls: Promise<{ ok: boolean; error?: string }>[] = [];
    for (const [userId, byFeature] of Object.entries(pending)) {
      for (const [featureKey, access] of Object.entries(byFeature)) {
        if (access) calls.push(updateStaffFeatureAccessAction(slug, userId, featureKey as FeatureKey, access));
      }
    }
    const results = await Promise.all(calls);
    setSaving(false);
    const failed = results.find((r) => !r.ok);
    if (failed) {
      toast.error(failed.error ?? "Could not save some permissions.");
      return;
    }
    toast.success("Permissions saved.");
    setPending({});
    router.refresh();
  }

  return (
    <SectionCard
      id="permissions"
      icon={ShieldCheck}
      title="Staff permissions"
      description="Control which sections each staff member can view or edit. Owners always have full access."
      footer={
        <>
          <div className="mr-auto flex flex-wrap gap-4 text-[12.5px] text-ink-muted">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-[#16A34A]" />
              Can edit
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-[#D97706]" />
              View only
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-ink-placeholder" />
              No access
            </span>
          </div>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || dirtyCount === 0}
            className="h-11 rounded-xl bg-primary px-5.5 text-sm font-bold text-primary-foreground shadow-[0_6px_16px_-6px_var(--primary)] hover:bg-primary disabled:opacity-50"
          >
            {saving ? <><Loader2 className="mr-2 size-4 animate-spin" />Saving...</> : "Save permissions"}
          </Button>
        </>
      }
    >
      <div className="overflow-x-auto border-t border-line-divider">
        <Table className="min-w-[860px]">
          <TableHeader>
            <TableRow className="bg-surface-footer hover:bg-surface-footer">
              <TableHead className="px-7 py-3 text-[12px] font-bold tracking-wider text-ink-muted uppercase">Staff member</TableHead>
              {FEATURES.map((f) => (
                <TableHead key={f.key} className="px-3 py-3 text-[12px] font-bold tracking-wider text-ink-muted uppercase">
                  {f.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="border-line-divider">
              <TableCell className="px-7 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[12.5px] font-extrabold text-primary">
                    {initialsOf(owner.name)}
                  </span>
                  <div className="flex flex-col leading-tight">
                    <span className="font-semibold text-ink">{owner.name}</span>
                    <span className="text-xs text-ink-muted">Owner</span>
                  </div>
                </div>
              </TableCell>
              <TableCell colSpan={5} className="px-3 py-4 pr-7">
                <span className="inline-flex items-center gap-2 rounded-full bg-[#EEF2FF] px-3 py-1.5 text-[12.5px] font-bold text-[#3730A3]">
                  <Check className="size-3.5" strokeWidth={2.2} />
                  Full access to every section
                </span>
              </TableCell>
            </TableRow>
            {members.map((m, i) => {
              const [avBg, avColor] = AVATAR_PALETTE[i % AVATAR_PALETTE.length]!;
              return (
                <TableRow key={m.id} className="border-line-divider hover:bg-[#FAFBFE]">
                  <TableCell className="px-7 py-4">
                    <div className="flex items-center gap-3">
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-full text-[12.5px] font-extrabold"
                        style={{ backgroundColor: avBg, color: avColor }}
                      >
                        {initialsOf(m.name)}
                      </span>
                      <span className="font-semibold text-ink">{m.name}</span>
                    </div>
                  </TableCell>
                  {FEATURES.map((f) => {
                    const value = valueFor(m, f);
                    const style = ACCESS_STYLE[value];
                    return (
                      <TableCell key={f.key} className="px-3 py-4">
                        <NativeSelect
                          compact
                          className="min-w-[130px]"
                          style={{ backgroundColor: style.bg, color: style.color, borderColor: style.border }}
                          aria-label={`${m.name} ${f.label} access`}
                          value={value}
                          onChange={(e) => setPendingValue(m.id, f.key, e.target.value as FeatureAccess)}
                        >
                          <option value="NONE">{ACCESS_LABELS.NONE}</option>
                          <option value="VIEW">{ACCESS_LABELS.VIEW}</option>
                          <option value="EDIT">{ACCESS_LABELS.EDIT}</option>
                        </NativeSelect>
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
            {members.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="px-7 py-10 text-center text-sm text-ink-muted">
                  No staff members yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  );
}
