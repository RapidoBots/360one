import { prisma } from "@/lib/prisma";
import { requireFeatureAccess } from "@/lib/auth-guards";
import { CustomerList } from "./customer-list";

export default async function CustomersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { access } = await requireFeatureAccess(slug, "customers", "VIEW");
  const restaurant = await prisma.restaurant.findUniqueOrThrow({ where: { slug } });

  const customers = await prisma.customer.findMany({
    where: { restaurantId: restaurant.id },
    include: {
      reservations: {
        select: { id: true, startsAt: true, partySize: true, status: true, table: { select: { number: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Customers</h1>
      <CustomerList slug={slug} customers={customers} canEdit={access === "EDIT"} />
    </div>
  );
}
