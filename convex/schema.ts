import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const CATEGORIES = [
  "power tools",
  "hand tools",
  "garden",
  "kitchen",
  "camping",
  "cleaning",
  "other",
] as const;

export const category = v.union(...CATEGORIES.map((c) => v.literal(c)));
export const condition = v.union(
  v.literal("like new"),
  v.literal("good"),
  v.literal("fair"),
  v.literal("worn"),
);
export const loanStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("declined"),
  v.literal("cancelled"),
  v.literal("returned"),
);

export default defineSchema({
  // Only what the app needs: a display name and an email for notifications.
  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.string(),
    email: v.optional(v.string()),
    role: v.union(v.literal("admin"), v.literal("user")),
    trustedLender: v.boolean(),
  }).index("by_token", ["tokenIdentifier"]),

  tools: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    category,
    condition,
    description: v.string(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_category", ["category"]),

  loans: defineTable({
    toolId: v.id("tools"),
    lenderId: v.id("users"),
    borrowerId: v.id("users"),
    startDate: v.string(), // YYYY-MM-DD
    endDate: v.string(), // YYYY-MM-DD, inclusive
    status: loanStatus,
    decidedAt: v.optional(v.number()),
    returnedAt: v.optional(v.number()),
  })
    .index("by_tool", ["toolId"])
    .index("by_lender", ["lenderId"])
    .index("by_borrower", ["borrowerId"])
    .index("by_status_end", ["status", "endDate"]),

  // Everything the automations did, keyed for idempotency.
  automationEvents: defineTable({
    eventKey: v.string(),
    kind: v.union(
      v.literal("request_notification"),
      v.literal("overdue_reminder"),
      v.literal("workflow_error"),
    ),
    loanId: v.optional(v.id("loans")),
    status: v.union(v.literal("sent"), v.literal("failed")),
    attempts: v.number(),
    updatedAt: v.optional(v.number()),
    detail: v.optional(v.string()),
  })
    .index("by_eventKey", ["eventKey"])
    .index("by_loan", ["loanId"]),
});
