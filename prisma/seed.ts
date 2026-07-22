import "dotenv/config";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function createUser(email: string, password: string, name: string) {
  const { user } = await auth.api.signUpEmail({ body: { email, password, name } });
  return user;
}

async function main() {
  const restaurant = await prisma.restaurant.upsert({
    where: { slug: "blue-fork" },
    update: {},
    create: { name: "The Blue Fork", slug: "blue-fork" },
  });

  const superAdmin = await createUser("admin@example.com", "password1234", "Super Admin");
  await prisma.user.update({ where: { id: superAdmin.id }, data: { role: "SUPER_ADMIN" } });

  const owner = await createUser("owner@blue-fork.example.com", "password1234", "Blue Fork Owner");
  await prisma.user.update({
    where: { id: owner.id },
    data: { role: "OWNER", restaurantId: restaurant.id },
  });

  const staff = await createUser("staff@blue-fork.example.com", "password1234", "Blue Fork Staff");
  await prisma.user.update({
    where: { id: staff.id },
    data: { role: "STAFF", restaurantId: restaurant.id },
  });

  console.log("Seeded:", {
    restaurant: restaurant.slug,
    superAdmin: superAdmin.email,
    owner: owner.email,
    staff: staff.email,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
