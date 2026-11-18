import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

// Dev-only helper used by scripts/smoke-test.sh to create an overdue loan
// (the public API refuses dates in the past). Internal, so clients can't call it.
export const backdateLoan = internalMutation({
  args: { loanId: v.id("loans"), startDate: v.string(), endDate: v.string() },
  handler: async (ctx, { loanId, startDate, endDate }) => {
    if (process.env.ALLOW_TEST_HELPERS !== "true") throw new Error("Test helpers are disabled.");
    await ctx.db.patch(loanId, { startDate, endDate });
  },
});
