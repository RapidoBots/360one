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

export function restaurantNavItems(
  slug: string,
  opts?: {
    schedulingEnabled?: boolean;
    canAccessSettings?: boolean;
    isStaff?: boolean;
    featureAccess?: { reservations: string; waitlist: string; floorManager: string; customers: string; reports: string };
  }
): NavItem[] {
  const base = `/r/${slug}`;
  const access = opts?.featureAccess;
  const items: NavItem[] = [
    { label: "Dashboard", href: `${base}/dashboard`, icon: "LayoutDashboard" },
  ];
  if (!access || access.reservations !== "NONE") {
    items.push({ label: "Reservations", href: `${base}/reservations`, icon: "CalendarClock" });
  }
  if (!access || access.waitlist !== "NONE") {
    items.push({ label: "Waiting Area", href: `${base}/waitlist`, icon: "ListOrdered" });
  }
  if (!access || access.floorManager !== "NONE") {
    items.push({ label: "Floor Manager", href: `${base}/floor-manager`, icon: "Map" });
  }
  if (!access || access.customers !== "NONE") {
    items.push({ label: "Customers", href: `${base}/customers`, icon: "Users" });
  }
  if (opts?.schedulingEnabled) {
    items.push({ label: opts.isStaff ? "My Shifts" : "Staff", href: `${base}/staff`, icon: "CalendarDays" });
  }
  if (!access || access.reports !== "NONE") {
    items.push({ label: "Reports", href: `${base}/reports`, icon: "BarChart3" });
  }
  // Settings stays owner-only — it's not one of the toggleable features.
  if (opts?.canAccessSettings) {
    items.push({ label: "Settings", href: `${base}/settings`, icon: "Settings" });
  }
  return items;
}

export const adminNavItems: NavItem[] = [
  { label: "Restaurants", href: "/admin/restaurants", icon: "Building2" },
  { label: "Subscriptions", href: "/admin/subscriptions", icon: "CreditCard" },
  { label: "Super Admins", href: "/admin/super-admins", icon: "Users" },
  { label: "Settings", href: "/admin/settings", icon: "Settings" },
];
