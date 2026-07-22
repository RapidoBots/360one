import { requireSuperAdmin } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { AccountSettingsForm } from "./account-settings-form";

export default async function AdminSettingsPage() {
  const sessionUser = await requireSuperAdmin();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: sessionUser.id },
    select: { name: true, email: true },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <AccountSettingsForm currentEmail={user.email} />
    </div>
  );
}
