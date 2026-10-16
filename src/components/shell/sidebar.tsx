"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  CalendarClock,
  CalendarDays,
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
  CalendarDays,
  ListOrdered,
  Map,
  Users,
  BarChart3,
  Settings,
  Building2,
  CreditCard,
};

export function Sidebar({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="flex flex-col gap-1 p-3">
      {items.map((item) => {
        const active = pathname.startsWith(item.href);
        const Icon = ICONS[item.icon];
        return (
          <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined}>
            <motion.div
              whileHover={{ x: 2 }}
              transition={{ duration: 0.15 }}
              className={cn(
                "flex h-11 items-center gap-3 rounded-xl px-3.5 text-sm",
                active
                  ? "bg-primary/10 font-bold text-primary"
                  : "font-medium text-[#334155] hover:bg-[#F1F3F9]"
              )}
            >
              <Icon className="size-5" strokeWidth={1.8} />
              {item.label}
            </motion.div>
          </Link>
        );
      })}
    </nav>
  );
}
