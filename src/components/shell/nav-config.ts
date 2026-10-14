export type NavIconName =
  | "LayoutDashboard"
  | "CalendarClock"
  | "ListOrdered"
  | "Map"
  | "Users"
  | "CalendarDays"
  | "BarChart3"
  | "Settings"
  | "Building2"
  | "CreditCard";

export type NavItem = { label: string; href: string; icon: NavIconName };

export function restaurantNavItems(slug: string, opts?: { schedulingEnabled?: boolean }): NavItem[] {
  const base = `/r/${slug}`;
  const items: NavItem[] = [
    { label: "Dashboard", href: `${base}/dashboard`, icon: "LayoutDashboard" },
    { label: "Reservations", href: `${base}/reservations`, icon: "CalendarClock" },
    { label: "Waiting Area", href: `${base}/waitlist`, icon: "ListOrdered" },
    { label: "Floor Manager", href: `${base}/floor-manager`, icon: "Map" },
    { label: "Customers", href: `${base}/customers`, icon: "Users" },
  ];
  if (opts?.schedulingEnabled) {
    items.push({ label: "Staff", href: `${base}/staff`, icon: "CalendarDays" });
  }
  items.push(
    { label: "Reports", href: `${base}/reports`, icon: "BarChart3" },
    { label: "Settings", href: `${base}/settings`, icon: "Settings" },
  );
  return items;
}

export const adminNavItems: NavItem[] = [
  { label: "Restaurants", href: "/admin/restaurants", icon: "Building2" },
  { label: "Subscriptions", href: "/admin/subscriptions", icon: "CreditCard" },
  { label: "Super Admins", href: "/admin/super-admins", icon: "Users" },
  { label: "Settings", href: "/admin/settings", icon: "Settings" },
];
