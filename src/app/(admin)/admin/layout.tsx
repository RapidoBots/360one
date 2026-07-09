import type { ReactNode } from "react";
import { requireSuperAdmin } from "@/lib/auth-guards";
import { ShellLayout } from "@/components/shell/shell-layout";
import { adminNavItems } from "@/components/shell/nav-config";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireSuperAdmin();
  return (
    <ShellLayout title="Super Admin" navItems={adminNavItems}>
      {children}
    </ShellLayout>
  );
}
