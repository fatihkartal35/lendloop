import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireAdmin } from "./lib/auth";
import { today } from "./lib/dates";

const kind = v.union(
  v.literal("request_notification"),
  v.literal("overdue_reminder"),
  v.literal("workflow_error"),
);

/**
 * Builds the smallest payload n8n needs to notify one person.
 * No tool description, no addresses, no ids of other users.
 */
export const notificationPayload = internalQuery({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const loan = await ctx.db.get(loanId);
    if (!loan) return null;
    const [tool, lender, borrower] = await Promise.all([
      ctx.db.get(loan.toolId),
      ctx.db.get(loan.lenderId),
      ctx.db.get(loan.borrowerId),
    ]);
    if (!lender || !borrower) return null;
    // New and cancelled requests go to the lender; decisions and returns go to the borrower.
    const toLender = loan.status === "pending" || loan.status === "cancelled";
    const recipient = toLender ? lender : borrower;
    const other = toLender ? borrower : lender;
    return {
      event: `loan.${loan.status}`,
      loanId: loan._id,
      recipient: { name: recipient.name, email: recipient.email ?? null },
      otherPartyName: other.name,
      toolName: tool?.name ?? "a tool",
      startDate: loan.startDate,
      endDate: loan.endDate,
    };
  },
});

export const getEvent = internalQuery({
  args: { eventKey: v.string() },
  handler: (ctx, { eventKey }) =>
    ctx.db
      .query("automationEvents")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
      .unique(),
});

/**
 * Idempotent: one row per eventKey. A "sent" row is never downgraded,
 * so retries and duplicate deliveries can't create duplicates or flip state.
 */
export const record = internalMutation({
  args: {
    eventKey: v.string(),
    kind,
    loanId: v.optional(v.string()),
    status: v.union(v.literal("sent"), v.literal("failed")),
    detail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const loanId = args.loanId ? ctx.db.normalizeId("loans", args.loanId) : null;
    if (args.loanId && !loanId) return { ok: false as const, reason: "unknown loan" };
    const detail = args.detail?.slice(0, 300);
    const existing = await ctx.db
      .query("automationEvents")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", args.eventKey))
      .unique();
    if (existing) {
      if (existing.status === "sent") return { ok: true as const, duplicate: true };
      await ctx.db.patch(existing._id, {
        status: args.status,
        attempts: existing.attempts + 1,
        detail,
        updatedAt: Date.now(),
      });
      return { ok: true as const, duplicate: false };
    }
    await ctx.db.insert("automationEvents", {
      eventKey: args.eventKey,
      kind: args.kind,
      loanId: loanId ?? undefined,
      status: args.status,
      attempts: 1,
      detail,
      updatedAt: Date.now(),
    });
    return { ok: true as const, duplicate: false };
  },
});

/** Approved, not returned, past the end date, and not yet reminded today. */
export const overdueLoans = internalQuery({
  args: {},
  handler: async (ctx) => {
    const day = today();
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_status_end", (q) => q.eq("status", "approved").lt("endDate", day))
      .take(500);
    const out = [];
    for (const loan of loans) {
      const eventKey = `overdue:${loan._id}:${day}`;
      const done = await ctx.db
        .query("automationEvents")
        .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
        .unique();
      if (done?.status === "sent") continue;
      const [tool, borrower] = await Promise.all([ctx.db.get(loan.toolId), ctx.db.get(loan.borrowerId)]);
      if (!borrower) continue;
      out.push({
        loanId: loan._id,
        eventKey,
        borrower: { name: borrower.name, email: borrower.email ?? null },
        toolName: tool?.name ?? "a tool",
        endDate: loan.endDate,
        daysOverdue: Math.round((Date.parse(day) - Date.parse(loan.endDate)) / 86_400_000),
      });
    }
    return { date: day, loans: out };
  },
});

export const recentFailures = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const events: Doc<"automationEvents">[] = await ctx.db
      .query("automationEvents")
      .order("desc")
      .take(200);
    return events
      .filter((e) => e.status === "failed")
      .slice(0, 20)
      .map((e) => ({
        _id: e._id,
        kind: e.kind,
        detail: e.detail ?? null,
        attempts: e.attempts,
        at: e.updatedAt ?? e._creationTime,
      }));
  },
});
