import type { AuthConfig } from "convex/server";

// Clerk issues the session token (Convex integration enabled in the Clerk
// dashboard, so the token's audience is "convex").
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
