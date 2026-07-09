"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { Brand } from "./brand";

export function TopNav({ title }: { title: string }) {
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/sign-in");
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background px-6">
      <div className="flex items-center gap-3">
        <Brand className="text-lg font-bold" />
        <span className="h-5 w-px bg-border" />
        <span className="text-base font-semibold">{title}</span>
      </div>
      <Button variant="ghost" size="sm" onClick={handleSignOut}>
        Sign out
      </Button>
    </header>
  );
}
