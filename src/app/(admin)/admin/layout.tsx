import type { ReactNode } from "react";
import { requireSuperAdmin } from "@/lib/auth-guards";
import { ShellLayout } from "@/components/shell/shell-layout";
import { adminNavItems } from "@/components/shell/nav-config";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireSuperAdmin();
  return (
    <ShellLayout title="Super Admin" userName={user.name} userRole={user.role} navItems={adminNavItems}>
      {children}
    </ShellLayout>
  );
}
