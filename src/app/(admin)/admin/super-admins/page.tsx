import { requireSuperAdmin } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { SuperAdmins } from "./super-admins";

export default async function SuperAdminsPage() {
  const sessionUser = await requireSuperAdmin();

  const admins = await prisma.user.findMany({
    where: { role: "SUPER_ADMIN" },
    select: { id: true, name: true, email: true, active: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Super Admins</h1>
      <SuperAdmins admins={admins} currentUserId={sessionUser.id} />
    </div>
  );
}
