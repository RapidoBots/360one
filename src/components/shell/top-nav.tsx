"use client";

import { useRouter } from "next/navigation";
import { Menu, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { Brand } from "./brand";

export function TopNav({ title, onMenuClick }: { title: string; onMenuClick: () => void }) {
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/sign-in");
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border bg-background px-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 md:hidden"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <Brand className="h-9 w-auto shrink-0" />
        <span className="hidden h-5 w-px shrink-0 bg-border sm:block" />
        <span className="hidden truncate text-base font-semibold sm:block">{title}</span>
      </div>
      <Button variant="ghost" className="h-11 shrink-0 px-3 text-base sm:px-5" onClick={handleSignOut}>
        <LogOut className="h-4 w-4 sm:hidden" />
        <span className="hidden sm:inline">Sign out</span>
        <span className="sr-only sm:hidden">Sign out</span>
      </Button>
    </header>
  );
}
