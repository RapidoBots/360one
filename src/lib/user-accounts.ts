import { auth } from "@/lib/auth";

export async function createUserAccount(input: { name: string; email: string; password: string }) {
  const { user } = await auth.api.signUpEmail({
    body: { name: input.name, email: input.email, password: input.password },
  });
  return user;
}
