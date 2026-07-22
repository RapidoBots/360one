import type { ReactNode } from "react";
import { requireRestaurantAccess } from "@/lib/auth-guards";
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
  const { restaurant } = await requireRestaurantAccess(slug);
  return (
    <ShellLayout title={restaurant.name} navItems={restaurantNavItems(slug)}>
      {children}
    </ShellLayout>
  );
}
