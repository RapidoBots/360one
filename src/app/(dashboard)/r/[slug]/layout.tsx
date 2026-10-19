import type { ReactNode } from "react";
import { requireRestaurantAccess, getAllFeatureAccess } from "@/lib/auth-guards";
import { ShellLayout } from "@/components/shell/shell-layout";
import { restaurantNavItems } from "@/components/shell/nav-config";

export default async function RestaurantLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { user, restaurant } = await requireRestaurantAccess(slug);
  const featureAccess = await getAllFeatureAccess(user);
  const canAccessSettings = user.role === "OWNER" || user.role === "SUPER_ADMIN";
  return (
    <ShellLayout
      title={restaurant.name}
      userName={user.name}
      userRole={user.role}
      navItems={restaurantNavItems(slug, {
        schedulingEnabled: restaurant.schedulingEnabled,
        canAccessSettings,
        isStaff: user.role === "STAFF",
        featureAccess,
      })}
    >
      {children}
    </ShellLayout>
  );
}
