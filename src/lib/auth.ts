import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  emailAndPassword: {
    enabled: true,
  },
  rateLimit: {
    customRules: {
      // Better Auth's built-in default is 3 requests / 10s, which real
      // staff members (and this app's own test suite) can hit under
      // normal multi-tab/retry use. Loosened, not disabled.
      "/sign-in/email": { window: 60, max: 20 },
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "STAFF",
        input: false,
      },
      restaurantId: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
});
