import { hashPassword } from "better-auth/crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function createUserAccount(input: { name: string; email: string; password: string }) {
  const { user } = await auth.api.signUpEmail({
    body: { name: input.name, email: input.email, password: input.password },
  });
  return user;
}

// Admin-initiated reset -- writes a new password hash directly rather than
// going through Better Auth's own changePassword flow, since that requires
// knowing the *current* password (the whole point here is resetting one
// someone else can't provide).
export async function setUserPassword(userId: string, newPassword: string): Promise<void> {
  const hash = await hashPassword(newPassword);
  const { count } = await prisma.account.updateMany({
    where: { userId, providerId: "credential" },
    data: { password: hash },
  });
  if (count === 0) throw new Error("No credential account found for this user");
}
