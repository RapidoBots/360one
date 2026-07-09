export type NavIconName =
  | "LayoutDashboard"
  | "CalendarClock"
  | "ListOrdered"
  | "Map"
  | "Users"
  | "BarChart3"
  | "Bell"
  | "Settings"
  | "Building2"
  | "CreditCard";

export type NavItem = { label: string; href: string; icon: NavIconName };

export function restaurantNavItems(slug: string): NavItem[] {
  const base = `/r/${slug}`;
  return [
    { label: "Dashboard", href: `${base}/dashboard`, icon: "LayoutDashboard" },
    { label: "Reservations", href: `${base}/reservations`, icon: "CalendarClock" },
    { label: "Waitlist", href: `${base}/waitlist`, icon: "ListOrdered" },
    { label: "Floor Manager", href: `${base}/floor-manager`, icon: "Map" },
    { label: "Customers", href: `${base}/customers`, icon: "Users" },
    { label: "Reports", href: `${base}/reports`, icon: "BarChart3" },
    { label: "Notifications", href: `${base}/notifications`, icon: "Bell" },
    { label: "Settings", href: `${base}/settings`, icon: "Settings" },
  ];
}

export const adminNavItems: NavItem[] = [
  { label: "Restaurants", href: "/admin/restaurants", icon: "Building2" },
  { label: "Subscriptions", href: "/admin/subscriptions", icon: "CreditCard" },
  { label: "Settings", href: "/admin/settings", icon: "Settings" },
];
