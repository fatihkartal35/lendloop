import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAdmin, requireUser } from "./lib/auth";
import { isDay, overlaps, today } from "./lib/dates";

const MAX_DAYS = 30;

async function hasApprovedOverlap(
  ctx: QueryCtx,
  toolId: Id<"tools">,
  start: string,
  end: string,
  except?: Id<"loans">,
) {
  const loans = await ctx.db
    .query("loans")
    .withIndex("by_tool", (q) => q.eq("toolId", toolId))
    .collect();
  return loans.some(
    (l) => l._id !== except && l.status === "approved" && overlaps(start, end, l.startDate, l.endDate),
  );
}

/** Queue a notification to n8n. Runs after the transaction commits. */
async function notify(ctx: MutationCtx, loanId: Id<"loans">, status: Doc<"loans">["status"]) {
  await ctx.scheduler.runAfter(0, internal.notify.deliver, {
    loanId,
    eventKey: `notify:${loanId}:${status}`,
    attempt: 1,
  });
}

export const request = mutation({
  args: { toolId: v.id("tools"), startDate: v.string(), endDate: v.string() },
  handler: async (ctx, { toolId, startDate, endDate }) => {
    const viewer = await requireUser(ctx);
    const tool = await ctx.db.get(toolId);
    if (!tool) throw new ConvexError("Tool not found.");
    if (tool.ownerId === viewer._id) throw new ConvexError("You can't borrow your own tool.");
    if (!isDay(startDate) || !isDay(endDate)) throw new ConvexError("Pick valid dates.");
    if (startDate < today()) throw new ConvexError("The start date is in the past.");
    if (endDate < startDate) throw new ConvexError("The end date is before the start date.");
    const days = (Date.parse(endDate) - Date.parse(startDate)) / 86_400_000 + 1;
    if (days > MAX_DAYS) throw new ConvexError(`Loans can be at most ${MAX_DAYS} days.`);
    if (await hasApprovedOverlap(ctx, toolId, startDate, endDate)) {
      throw new ConvexError("The tool is already lent out for some of those days.");
    }
    const mine = await ctx.db
      .query("loans")
      .withIndex("by_borrower", (q) => q.eq("borrowerId", viewer._id))
      .collect();
    if (mine.some((l) => l.toolId === toolId && l.status === "pending")) {
      throw new ConvexError("You already have a pending request for this tool.");
    }
    const loanId = await ctx.db.insert("loans", {
      toolId,
      lenderId: tool.ownerId,
      borrowerId: viewer._id,
      startDate,
      endDate,
      status: "pending",
    });
    await notify(ctx, loanId, "pending");
    return loanId;
  },
});

export const decide = mutation({
  args: { loanId: v.id("loans"), approve: v.boolean() },
  handler: async (ctx, { loanId, approve }) => {
    const viewer = await requireUser(ctx);
    const loan = await ctx.db.get(loanId);
    if (!loan) throw new ConvexError("Request not found.");
    if (loan.lenderId !== viewer._id) throw new ConvexError("Only the owner can answer this request.");
    if (loan.status !== "pending") throw new ConvexError("This request was already handled.");
    if (approve && (await hasApprovedOverlap(ctx, loan.toolId, loan.startDate, loan.endDate, loanId))) {
      throw new ConvexError("Those dates clash with a loan you already approved.");
    }
    const status = approve ? "approved" : "declined";
    await ctx.db.patch(loanId, { status, decidedAt: Date.now() });
    await notify(ctx, loanId, status);
  },
});

export const cancel = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const viewer = await requireUser(ctx);
    const loan = await ctx.db.get(loanId);
    if (!loan) throw new ConvexError("Request not found.");
    if (loan.borrowerId !== viewer._id) throw new ConvexError("You can only cancel your own requests.");
    if (loan.status !== "pending") throw new ConvexError("Only pending requests can be cancelled.");
    await ctx.db.patch(loanId, { status: "cancelled", decidedAt: Date.now() });
    await notify(ctx, loanId, "cancelled");
  },
});

export const markReturned = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const viewer = await requireUser(ctx);
    const loan = await ctx.db.get(loanId);
    if (!loan) throw new ConvexError("Loan not found.");
    // The lender confirms the tool came back.
    if (loan.lenderId !== viewer._id) throw new ConvexError("Only the owner can mark a loan as returned.");
    if (loan.status !== "approved") throw new ConvexError("Only active loans can be returned.");
    await ctx.db.patch(loanId, { status: "returned", returnedAt: Date.now() });
    await notify(ctx, loanId, "returned");
  },
});

async function present(ctx: QueryCtx, loan: Doc<"loans">) {
  const [tool, lender, borrower, events] = await Promise.all([
    ctx.db.get(loan.toolId),
    ctx.db.get(loan.lenderId),
    ctx.db.get(loan.borrowerId),
    ctx.db
      .query("automationEvents")
      .withIndex("by_loan", (q) => q.eq("loanId", loan._id))
      .order("desc")
      .take(5),
  ]);
  return {
    _id: loan._id,
    toolName: tool?.name ?? "Removed tool",
    lenderName: lender?.name ?? "Unknown",
    borrowerName: borrower?.name ?? "Unknown",
    startDate: loan.startDate,
    endDate: loan.endDate,
    status: loan.status,
    overdue: loan.status === "approved" && loan.endDate < today(),
    activity: events.map((e) => ({
      kind: e.kind,
      status: e.status,
      at: e._creationTime,
      updatedAt: e.updatedAt ?? e._creationTime,
    })),
  };
}

export const myRequests = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireUser(ctx);
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_borrower", (q) => q.eq("borrowerId", viewer._id))
      .order("desc")
      .take(100);
    return Promise.all(loans.map((l) => present(ctx, l)));
  },
});

export const incoming = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireUser(ctx);
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_lender", (q) => q.eq("lenderId", viewer._id))
      .order("desc")
      .take(100);
    return Promise.all(loans.map((l) => present(ctx, l)));
  },
});

export const all = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const loans = await ctx.db.query("loans").order("desc").take(200);
    return Promise.all(loans.map((l) => present(ctx, l)));
  },
});
