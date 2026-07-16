"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  CalendarClock,
  ListOrdered,
  Map,
  Users,
  BarChart3,
  Settings,
  Building2,
  CreditCard,
  type LucideIcon,
} from "lucide-react";
import type { NavIconName, NavItem } from "./nav-config";
import { cn } from "@/lib/utils";

const ICONS: Record<NavIconName, LucideIcon> = {
  LayoutDashboard,
  CalendarClock,
  ListOrdered,
  Map,
  Users,
  BarChart3,
  Settings,
  Building2,
  CreditCard,
};

export function Sidebar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <aside className="w-72 shrink-0 border-r border-border bg-background p-4">
      <nav className="flex flex-col gap-1.5">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = ICONS[item.icon];
          return (
            <Link key={item.href} href={item.href}>
              <motion.div
                whileHover={{ x: 2 }}
                transition={{ duration: 0.15 }}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-3 text-base font-medium",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-foreground/70 hover:bg-muted"
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </motion.div>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
