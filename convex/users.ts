import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getViewer, requireAdmin } from "./lib/auth";

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Called after sign-in. Creates or refreshes the user row from the Clerk token. */
export const store = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Sign in first.");
    const email = identity.email?.toLowerCase();
    const name = identity.name ?? identity.givenName ?? email?.split("@")[0] ?? "Neighbor";
    const existing = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    // Admin is bootstrapped from an env allow-list; it is never taken from the client.
    const isAdmin = !!email && adminEmails().includes(email);
    if (existing) {
      await ctx.db.patch(existing._id, {
        name,
        email,
        role: isAdmin ? "admin" : existing.role,
      });
      return existing._id;
    }
    return await ctx.db.insert("users", {
      tokenIdentifier: identity.tokenIdentifier,
      name,
      email,
      role: isAdmin ? "admin" : "user",
      trustedLender: false,
    });
  },
});

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const user = await getViewer(ctx);
    if (!user) return null;
    return { _id: user._id, name: user.name, role: user.role, trustedLender: user.trustedLender };
  },
});

export const listForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    return users.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      trustedLender: u.trustedLender,
    }));
  },
});

export const setTrustedLender = mutation({
  args: { userId: v.id("users"), trusted: v.boolean() },
  handler: async (ctx, { userId, trusted }) => {
    await requireAdmin(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError("User not found.");
    await ctx.db.patch(userId, { trustedLender: trusted });
  },
});
