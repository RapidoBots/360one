import type { ReactNode } from "react";
import { TopNav } from "./top-nav";
import { Sidebar } from "./sidebar";
import type { NavItem } from "./nav-config";

export function ShellLayout({
  title,
  navItems,
  children,
}: {
  title: string;
  navItems: NavItem[];
  children: ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col">
      <TopNav title={title} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar items={navItems} />
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  );
}
