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
      // normal multi-tab/retry use. Loosened, not disabled -- raised again
      // as the e2e suite grew past ~20 total sign-ins per full run.
      "/sign-in/email": { window: 60, max: 60 },
    },
  },
  user: {
    changeEmail: {
      enabled: true,
      // This app has no email-verification flow (no sendVerificationEmail
      // configured), so every user's emailVerified is always false --
      // apply the change immediately rather than requiring a step we
      // never implemented.
      updateEmailWithoutVerification: true,
    },
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
      active: {
        type: "boolean",
        required: false,
        defaultValue: true,
        input: false,
      },
    },
  },
});
