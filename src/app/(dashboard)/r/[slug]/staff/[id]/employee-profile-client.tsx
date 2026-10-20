"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Mail, User, ShieldCheck, Lock, Eye, EyeOff, Loader2, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { SectionCard, FieldLabel, FieldHint } from "@/components/ui/section-card";
import {
  updateTeamMemberAction,
  setTeamMemberActiveAction,
  deleteTeamMemberAction,
  updateStaffFeatureAccessAction,
} from "../../settings/actions";
import type { Role, FeatureAccess } from "@/generated/prisma/client";

export type EmployeeProfileMember = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: Date;
  reservationsAccess: FeatureAccess;
  waitlistAccess: FeatureAccess;
  floorManagerAccess: FeatureAccess;
  customersAccess: FeatureAccess;
  reportsAccess: FeatureAccess;
};

const fieldClass =
  "h-11 w-full rounded-xl border-line-input bg-white px-3.5 text-sm font-medium text-ink focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/16";

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

// Matches the index basis Settings > Team members / Staff permissions use
// (position within the STAFF-only list, owner excluded) so the same person
// gets the same avatar color on every page.
function avatarFor(member: EmployeeProfileMember, staffMembers: EmployeeProfileMember[]): [string, string] {
  if (member.role === "OWNER") return ["color-mix(in srgb, var(--primary) 10%, white)", "var(--primary)"];
  const i = staffMembers.findIndex((m) => m.id === member.id);
  return AVATAR_PALETTE[i % AVATAR_PALETTE.length]!;
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(d: Date): string {
  return new Date(d).toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

const FEATURES: { key: "reservations" | "waitlist" | "floorManager" | "customers" | "reports"; label: string; desc: string }[] = [
  { key: "reservations", label: "Reservations", desc: "View and manage the reservations calendar" },
  { key: "waitlist", label: "Waiting Area", desc: "See and seat walk-in guests" },
  { key: "floorManager", label: "Floor Manager", desc: "Edit tables and the floor plan" },
  { key: "customers", label: "Customers", desc: "View the guest list and history" },
  { key: "reports", label: "Reports", desc: "See sales and booking reports" },
];

const ACCESS_LABELS: Record<FeatureAccess, string> = { NONE: "No access", VIEW: "View only", EDIT: "Can edit" };
const ACCESS_STYLE: Record<FeatureAccess, { bg: string; color: string; border: string }> = {
  NONE: { bg: "var(--neutral-soft)", color: "var(--neutral)", border: "#E2E8F0" },
  VIEW: { bg: "var(--warning-soft)", color: "var(--warning)", border: "#FDE68A" },
  EDIT: { bg: "var(--success-soft)", color: "var(--success)", border: "#BBF7D0" },
};

export function EmployeeProfileClient({
  slug,
  member,
  members,
  lastSignInAt,
}: {
  slug: string;
  member: EmployeeProfileMember;
  members: EmployeeProfileMember[];
  lastSignInAt: Date | null;
}) {
  const router = useRouter();
  const isOwner = member.role === "OWNER";
  const staffMembers = members.filter((m) => m.role === "STAFF");
  const [avBg, avColor] = avatarFor(member, staffMembers);

  // Profile form
  const [name, setName] = useState(member.name);
  const [email, setEmail] = useState(member.email);
  const [role, setRole] = useState<Role>(member.role);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savedProfile, setSavedProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Permissions
  const [perms, setPerms] = useState<Record<string, FeatureAccess>>({
    reservations: member.reservationsAccess,
    waitlist: member.waitlistAccess,
    floorManager: member.floorManagerAccess,
    customers: member.customersAccess,
    reports: member.reportsAccess,
  });
  const [savingPerms, setSavingPerms] = useState(false);
  const [savedPerms, setSavedPerms] = useState(false);

  // Security
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [savedPw, setSavedPw] = useState(false);

  // Status + delete
  const [toggling, setToggling] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const cantSaveProfile = !name.trim() || !email.trim();
  const accessCount = Object.values(perms).filter((v) => v !== "NONE").length;

  async function handleSaveProfile() {
    if (cantSaveProfile) return;
    setSavingProfile(true);
    setProfileError(null);
    const result = await updateTeamMemberAction(slug, member.id, { name: name.trim(), email: email.trim(), role });
    setSavingProfile(false);
    if (!result.ok) {
      setProfileError(result.error);
      return;
    }
    setSavedProfile(true);
    router.refresh();
  }

  async function handleSavePerms() {
    setSavingPerms(true);
    const results = await Promise.all(
      FEATURES.map((f) => updateStaffFeatureAccessAction(slug, member.id, f.key, perms[f.key]!))
    );
    setSavingPerms(false);
    const failed = results.find((r) => !r.ok);
    if (failed) {
      toast.error(failed.error ?? "Could not save permissions.");
      return;
    }
    setSavedPerms(true);
    router.refresh();
  }

  async function handleToggleStatus() {
    setToggling(true);
    const result = await setTeamMemberActiveAction(slug, member.id, !member.active);
    setToggling(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  }

  async function handleSavePassword() {
    if (!password) return;
    setSavingPw(true);
    const result = await updateTeamMemberAction(slug, member.id, {
      name: member.name, email: member.email, role: member.role, newPassword: password,
    });
    setSavingPw(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setPassword("");
    setShowPw(false);
    setSavedPw(true);
  }

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteTeamMemberAction(slug, member.id);
    setDeleting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${member.name} was removed from the team.`);
    router.push(`/r/${slug}/settings#team`);
  }

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-6">
      {/* Breadcrumb + switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm font-semibold">
          <Link
            href={`/r/${slug}/settings#team`}
            className="-ml-2.5 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[#475569] hover:bg-[#F1F3F9]"
          >
            <ArrowLeft className="size-4" />
            Team members
          </Link>
          <span className="text-line-input">/</span>
          <span aria-current="page" className="text-ink">{member.name}</span>
        </nav>
        <div role="group" aria-label="Switch employee" className="flex flex-wrap gap-2">
          {members.map((m) => {
            const on = m.id === member.id;
            const [chipBg, chipColor] = avatarFor(m, members.filter((x) => x.role === "STAFF"));
            return (
              <Link
                key={m.id}
                href={`/r/${slug}/staff/${m.id}`}
                aria-current={on ? "page" : undefined}
                className={`flex h-10 items-center gap-2 rounded-full py-0 pl-1.5 pr-3.5 text-[13.5px] font-semibold transition-colors ${
                  on
                    ? "border border-transparent bg-primary/10 text-primary"
                    : "border border-line-input bg-white text-[#475569] hover:bg-[#F8F9FD]"
                }`}
              >
                <span
                  className="flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold"
                  style={{ backgroundColor: chipBg, color: chipColor }}
                >
                  {initialsOf(m.name)}
                </span>
                {m.name}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Profile header card */}
      <section className="overflow-hidden rounded-[20px] border border-line-card bg-white shadow-card">
        <div
          className="h-24"
          style={{ background: "linear-gradient(120deg, color-mix(in srgb, var(--primary) 10%, white), #EEF1FB 60%, var(--surface-footer))" }}
        />
        <div className="flex flex-wrap items-end gap-x-5 gap-y-4 px-7 pb-6">
          <div
            className="-mt-12 flex size-24 shrink-0 items-center justify-center rounded-full border-4 border-white text-[30px] font-extrabold shadow-[0_6px_16px_-8px_rgba(15,23,42,0.3)]"
            style={{ backgroundColor: avBg, color: avColor }}
          >
            {initialsOf(member.name)}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2 pt-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-ink">{member.name}</h1>
              <span
                className={`rounded-full px-2.5 py-1 text-[11.5px] font-bold tracking-wide ${
                  isOwner ? "bg-[#EEF2FF] text-[#3730A3]" : "bg-neutral-soft text-[#334155]"
                }`}
              >
                {member.role}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
                  member.active ? "bg-success-soft text-success" : "bg-neutral-soft text-[#475569]"
                }`}
              >
                <span className={`size-1.5 rounded-full ${member.active ? "bg-[#16A34A]" : "bg-ink-placeholder"}`} />
                {member.active ? "Active" : "Inactive"}
              </span>
            </div>
            <div className="text-sm text-ink-muted">{member.email}</div>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <a
              href={`mailto:${member.email}`}
              className="flex h-11 items-center gap-2 rounded-xl border border-[#D5DAEA] bg-white px-4.5 text-sm font-semibold text-ink hover:bg-[#F8F9FD]"
            >
              <Mail className="size-4" />
              Email
            </a>
            {!isOwner && (
              <Button
                variant="outline"
                onClick={handleToggleStatus}
                disabled={toggling}
                className="h-11 rounded-xl border-[#D5DAEA] text-sm font-semibold text-ink"
              >
                {toggling ? <Loader2 className="size-4 animate-spin" /> : member.active ? "Deactivate" : "Activate"}
              </Button>
            )}
          </div>
        </div>
        {/* Stats */}
        <div className="grid grid-cols-1 border-t border-line-divider sm:grid-cols-2">
          <div className="border-b border-line-divider px-7 py-5 sm:border-r sm:border-b-0">
            <div className="text-xs font-bold tracking-wider text-ink-muted uppercase">Access</div>
            <div className="mt-1 text-[22px] font-extrabold tracking-tight text-ink">
              {isOwner ? "Full" : `${accessCount} of 5`}
            </div>
            <div className="mt-0.5 text-[12.5px] text-ink-muted">
              {isOwner ? "All sections" : "Sections available"}
            </div>
          </div>
          <div className="px-7 py-5">
            <div className="text-xs font-bold tracking-wider text-ink-muted uppercase">Member since</div>
            <div className="mt-1 text-[22px] font-extrabold tracking-tight text-ink">{formatDate(member.createdAt)}</div>
            <div className="mt-0.5 text-[12.5px] text-ink-muted">Joined this restaurant</div>
          </div>
        </div>
      </section>

      {/* Two columns */}
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-6">
          {/* Personal details */}
          <SectionCard
            icon={User}
            title="Personal details"
            description="Name, contact info and role."
            footer={
              <>
                {savedProfile && <span className="mr-auto text-[13.5px] font-semibold text-success">Profile saved</span>}
                <Button
                  onClick={handleSaveProfile}
                  disabled={cantSaveProfile || savingProfile}
                  className="h-11 rounded-xl px-5.5 text-sm font-bold shadow-[0_6px_16px_-6px_var(--primary)]"
                >
                  {savingProfile ? <><Loader2 className="mr-2 size-4 animate-spin" />Saving...</> : "Save profile"}
                </Button>
              </>
            }
          >
            <div className="grid grid-cols-1 gap-5 p-7 sm:grid-cols-2">
              <label className="flex flex-col gap-2">
                <FieldLabel>Staff name</FieldLabel>
                <Input
                  value={name}
                  onChange={(e) => { setName(e.target.value); setSavedProfile(false); }}
                  className={fieldClass}
                />
              </label>
              <label className="flex flex-col gap-2">
                <FieldLabel>Email</FieldLabel>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setSavedProfile(false); }}
                  className={fieldClass}
                />
              </label>
              <label className="flex flex-col gap-2 sm:col-span-2">
                <FieldLabel>Role</FieldLabel>
                <NativeSelect
                  className={`${fieldClass} pl-3.5 pr-9 sm:w-[240px]`}
                  value={role}
                  disabled={isOwner}
                  onChange={(e) => { setRole(e.target.value as Role); setSavedProfile(false); }}
                >
                  <option value="OWNER">Owner</option>
                  <option value="STAFF">Staff</option>
                </NativeSelect>
                <FieldHint>
                  {isOwner ? "The owner role can't be changed." : "Staff access is set under Access and permissions."}
                </FieldHint>
              </label>
              {profileError && <p className="text-sm text-destructive sm:col-span-2">{profileError}</p>}
            </div>
          </SectionCard>

          {/* Access and permissions */}
          <SectionCard
            icon={ShieldCheck}
            title="Access and permissions"
            description={`What ${member.name} can see and change.`}
            footer={
              !isOwner ? (
                <>
                  {savedPerms && <span className="mr-auto text-[13.5px] font-semibold text-success">Permissions saved</span>}
                  <Button
                    onClick={handleSavePerms}
                    disabled={savingPerms}
                    className="h-11 rounded-xl px-5.5 text-sm font-bold shadow-[0_6px_16px_-6px_var(--primary)]"
                  >
                    {savingPerms ? <><Loader2 className="mr-2 size-4 animate-spin" />Saving...</> : "Save permissions"}
                  </Button>
                </>
              ) : undefined
            }
          >
            {isOwner ? (
              <div className="flex items-center gap-3 border-t border-line-divider bg-success-soft px-7 py-7 text-sm font-semibold text-success">
                <ShieldCheck className="size-5" />
                Full access to every section. Owner permissions can&apos;t be changed.
              </div>
            ) : (
              <div className="border-t border-line-divider">
                {FEATURES.map((f) => {
                  const value = perms[f.key]!;
                  const style = ACCESS_STYLE[value];
                  return (
                    <div
                      key={f.key}
                      className="flex flex-wrap items-center justify-between gap-3 border-b border-line-divider px-7 py-4 last:border-b-0"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-ink">{f.label}</div>
                        <div className="mt-0.5 text-[13px] text-ink-muted">{f.desc}</div>
                      </div>
                      <NativeSelect
                        compact
                        aria-label={`${member.name} ${f.label} access`}
                        className="w-[170px]"
                        style={{ backgroundColor: style.bg, color: style.color, borderColor: style.border }}
                        value={value}
                        onChange={(e) => {
                          setPerms((prev) => ({ ...prev, [f.key]: e.target.value as FeatureAccess }));
                          setSavedPerms(false);
                        }}
                      >
                        <option value="NONE">{ACCESS_LABELS.NONE}</option>
                        <option value="VIEW">{ACCESS_LABELS.VIEW}</option>
                        <option value="EDIT">{ACCESS_LABELS.EDIT}</option>
                      </NativeSelect>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Right column */}
        <div className="flex min-w-0 flex-[1_1_320px] max-w-full flex-col gap-6">
          <SectionCard icon={Lock} title="Sign-in and security" description="Reset the password used to sign in.">
            <div className="flex flex-col gap-5 border-t border-line-divider p-7">
              <label className="flex flex-col gap-2">
                <FieldLabel>New password</FieldLabel>
                <div className="relative flex items-center">
                  <Input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setSavedPw(false); }}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className={`${fieldClass} pr-11`}
                  />
                  <button
                    type="button"
                    aria-label={showPw ? "Hide password" : "Show password"}
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-1.5 flex size-9 items-center justify-center rounded-[10px] text-[#475569] hover:bg-[#F1F3F9]"
                  >
                    {showPw ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
                  </button>
                </div>
                <FieldHint>Leave blank to keep the current password.</FieldHint>
              </label>
              <Button
                onClick={handleSavePassword}
                disabled={!password || savingPw}
                className="h-11 rounded-xl text-sm font-bold"
              >
                {savingPw ? <><Loader2 className="mr-2 size-4 animate-spin" />Updating...</> : "Update password"}
              </Button>
              {savedPw && <span className="text-[13.5px] font-semibold text-success">Password updated</span>}
              <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-3 border-t border-line-divider pt-5 text-[13.5px]">
                <span className="text-ink-muted">Last sign-in</span>
                <span className="text-right font-semibold text-ink">
                  {lastSignInAt ? formatDateTime(lastSignInAt) : "Never signed in"}
                </span>
                <span className="text-ink-muted">Member since</span>
                <span className="text-right font-semibold text-ink">{formatDate(member.createdAt)}</span>
              </div>
            </div>
          </SectionCard>

          {!isOwner && (
            <section className="overflow-hidden rounded-[20px] border border-danger/30 bg-white">
              <div className="flex flex-col gap-3 p-7">
                <h2 className="text-lg font-bold text-danger">Remove from team</h2>
                <p className="text-[13.5px] leading-relaxed text-ink-muted">
                  Deleting {member.name} removes their access and profile. Their past reservation activity stays in
                  your records.
                </p>
                {confirmDelete ? (
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Button
                      variant="outline"
                      onClick={() => setConfirmDelete(false)}
                      className="h-11 rounded-xl border-[#D5DAEA] text-sm font-semibold text-ink"
                    >
                      Keep
                    </Button>
                    <Button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="h-11 rounded-xl bg-danger text-sm font-bold text-white hover:bg-danger/90"
                    >
                      {deleting ? <><Loader2 className="mr-2 size-4 animate-spin" />Deleting...</> : "Yes, delete"}
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => setConfirmDelete(true)}
                    className="h-11 w-fit gap-2 rounded-xl border-danger/30 text-sm font-semibold text-danger hover:bg-danger-soft"
                  >
                    <Trash2 className="size-4" />
                    Delete staff member
                  </Button>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
