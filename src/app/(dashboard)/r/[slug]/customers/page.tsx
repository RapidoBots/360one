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
    <div className="-m-4 min-h-[calc(100vh-4rem)] bg-surface-page p-5 [@media(min-width:375px)]:p-[clamp(20px,3vw,40px)] md:-m-8">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[32px] font-extrabold tracking-tight text-ink">Customers</h1>
          <p className="text-[15px] text-ink-muted">Everyone who has booked a table with you.</p>
        </div>
        <CustomerList slug={slug} customers={customers} canEdit={access === "EDIT"} />
      </div>
    </div>
  );
}
