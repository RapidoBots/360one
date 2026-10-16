"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { TopNav } from "./top-nav";
import { Sidebar } from "./sidebar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { NavItem } from "./nav-config";

export function ShellLayout({
  title,
  userName,
  userRole,
  navItems,
  children,
}: {
  title: string;
  userName: string;
  userRole: string;
  navItems: NavItem[];
  children: ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-screen flex-col">
      <TopNav title={title} userName={userName} userRole={userRole} onMenuClick={() => setMobileNavOpen(true)} />
      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-[248px] shrink-0 overflow-y-auto border-r border-line-card bg-white [@media(min-width:821px)]:block">
          <Sidebar items={navItems} />
        </aside>

        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent side="left" className="w-[280px] gap-0 p-0">
            <SheetHeader className="border-b border-line-card">
              <SheetTitle>{title}</SheetTitle>
            </SheetHeader>
            <div className="overflow-y-auto">
              <Sidebar items={navItems} onNavigate={() => setMobileNavOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>

        <main className="min-w-0 flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
