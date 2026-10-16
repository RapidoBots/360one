"use client";

import { useRouter } from "next/navigation";
import { Menu, LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Brand } from "./brand";

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  OWNER: "Owner",
  STAFF: "Staff",
};

export function TopNav({
  title,
  userName,
  userRole,
  onMenuClick,
}: {
  title: string;
  userName: string;
  userRole: string;
  onMenuClick: () => void;
}) {
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/sign-in");
  }

  function initialsOf(name: string) {
    return name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    <header className="sticky top-0 z-[60] flex h-16 shrink-0 items-center justify-between gap-3 border-b border-line-card bg-white px-4 [@media(min-width:520px)]:px-[clamp(16px,3vw,28px)]">
      <div className="flex min-w-0 items-center gap-3.5">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
          className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-line-input bg-white text-ink hover:bg-[#F1F3F9] [@media(min-width:821px)]:hidden"
        >
          <Menu className="size-5" />
        </button>
        <Brand className="h-8 w-auto shrink-0" />
        <span className="hidden h-6 w-px shrink-0 bg-line-input [@media(min-width:521px)]:block" />
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-primary/10 text-xs font-extrabold text-primary">
            {initialsOf(title)}
          </span>
          <span className="hidden truncate text-sm font-bold text-ink [@media(min-width:521px)]:block">
            {title}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-2.5 [@media(min-width:641px)]:flex">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-[12.5px] font-extrabold text-white">
            {initialsOf(userName)}
          </span>
          <div className="leading-tight">
            <p className="text-[13px] font-bold text-ink">{userName}</p>
            <p className="text-xs text-ink-muted">{ROLE_LABELS[userRole] ?? userRole}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          aria-label="Sign out"
          className="flex h-10 shrink-0 items-center gap-2 rounded-xl border border-line-input bg-white px-3.5 text-[13.5px] font-semibold text-ink hover:bg-[#F1F3F9] [@media(max-width:520px)]:px-0 [@media(max-width:520px)]:w-10 [@media(max-width:520px)]:justify-center"
        >
          <LogOut className="size-4" />
          <span className="[@media(max-width:520px)]:hidden">Sign out</span>
        </button>
      </div>
    </header>
  );
}
