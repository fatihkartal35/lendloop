import { ConvexError, v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { category, condition } from "./schema";
import { requireUser } from "./lib/auth";
import { today } from "./lib/dates";

async function currentLoan(ctx: QueryCtx, toolId: Id<"tools">) {
  const day = today();
  const loans = await ctx.db
    .query("loans")
    .withIndex("by_tool", (q) => q.eq("toolId", toolId))
    .collect();
  return loans.find((l) => l.status === "approved" && l.startDate <= day) ?? null;
}

function clean(s: string, max: number, field: string) {
  const t = s.trim();
  if (!t) throw new ConvexError(`${field} is required.`);
  if (t.length > max) throw new ConvexError(`${field} must be at most ${max} characters.`);
  return t;
}

/** Public board: name and category only, no owner details. */
export const listPublic = query({
  args: {},
  handler: async (ctx) => {
    const tools = await ctx.db.query("tools").order("desc").take(200);
    const out = [];
    for (const t of tools) {
      if (await currentLoan(ctx, t._id)) continue;
      out.push({ _id: t._id, name: t.name, category: t.category });
    }
    return out;
  },
});

export const list = query({
  args: { category: v.optional(category) },
  handler: async (ctx, args) => {
    const viewer = await requireUser(ctx);
    const tools = args.category
      ? await ctx.db
          .query("tools")
          .withIndex("by_category", (q) => q.eq("category", args.category!))
          .order("desc")
          .take(200)
      : await ctx.db.query("tools").order("desc").take(200);
    return Promise.all(tools.map((t) => withDetails(ctx, t, viewer)));
  },
});

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireUser(ctx);
    const tools = await ctx.db
      .query("tools")
      .withIndex("by_owner", (q) => q.eq("ownerId", viewer._id))
      .order("desc")
      .collect();
    return Promise.all(tools.map((t) => withDetails(ctx, t, viewer)));
  },
});

async function withDetails(ctx: QueryCtx, t: Doc<"tools">, viewer: Doc<"users">) {
  const owner = await ctx.db.get(t.ownerId);
  const loan = await currentLoan(ctx, t._id);
  return {
    _id: t._id,
    name: t.name,
    category: t.category,
    condition: t.condition,
    description: t.description,
    ownerName: owner?.name ?? "Unknown",
    ownerTrusted: owner?.trustedLender ?? false,
    isMine: t.ownerId === viewer._id,
    available: !loan,
    onLoanUntil: loan?.endDate ?? null,
  };
}

const toolFields = {
  name: v.string(),
  category,
  condition,
  description: v.string(),
};

export const create = mutation({
  args: toolFields,
  handler: async (ctx, args) => {
    const viewer = await requireUser(ctx);
    return await ctx.db.insert("tools", {
      ownerId: viewer._id,
      name: clean(args.name, 80, "Name"),
      category: args.category,
      condition: args.condition,
      description: clean(args.description, 500, "Description"),
    });
  },
});

export const update = mutation({
  args: { toolId: v.id("tools"), ...toolFields },
  handler: async (ctx, { toolId, ...args }) => {
    const viewer = await requireUser(ctx);
    const tool = await ctx.db.get(toolId);
    if (!tool) throw new ConvexError("Tool not found.");
    // Users edit only their own listings. Admins can remove, not edit.
    if (tool.ownerId !== viewer._id) throw new ConvexError("You can only edit your own listings.");
    await ctx.db.patch(toolId, {
      name: clean(args.name, 80, "Name"),
      category: args.category,
      condition: args.condition,
      description: clean(args.description, 500, "Description"),
    });
  },
});

export const remove = mutation({
  args: { toolId: v.id("tools") },
  handler: async (ctx, { toolId }) => {
    const viewer = await requireUser(ctx);
    const tool = await ctx.db.get(toolId);
    if (!tool) throw new ConvexError("Tool not found.");
    const isOwner = tool.ownerId === viewer._id;
    if (!isOwner && viewer.role !== "admin") {
      throw new ConvexError("You can only delete your own listings.");
    }
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_tool", (q) => q.eq("toolId", toolId))
      .collect();
    if (isOwner && viewer.role !== "admin" && loans.some((l) => l.status === "approved")) {
      throw new ConvexError("Mark the active loan as returned before deleting this tool.");
    }
    for (const l of loans) {
      if (l.status === "pending" || l.status === "approved") {
        await ctx.db.patch(l._id, { status: "cancelled", decidedAt: Date.now() });
      }
    }
    await ctx.db.delete(toolId);
  },
});

