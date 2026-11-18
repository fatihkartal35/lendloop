import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { secret, sign } from "./lib/hmac";

const MAX_ATTEMPTS = 5;

/**
 * Sends one signed request event to the n8n webhook.
 * Retries with exponential backoff; every attempt is recorded so failures are visible.
 */
export const deliver = internalAction({
  args: { loanId: v.id("loans"), eventKey: v.string(), attempt: v.number() },
  handler: async (ctx, { loanId, eventKey, attempt }) => {
    const done = await ctx.runQuery(internal.automation.getEvent, { eventKey });
    if (done?.status === "sent") return;

    const payload = await ctx.runQuery(internal.automation.notificationPayload, { loanId });
    if (!payload) return;

    const url = process.env.N8N_REQUEST_WEBHOOK_URL;
    let error: string | null = null;
    if (!url) {
      error = "N8N_REQUEST_WEBHOOK_URL is not set";
    } else {
      try {
        const body = JSON.stringify({ ...payload, eventKey });
        const timestamp = String(Date.now());
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-lendloop-timestamp": timestamp,
            "x-lendloop-signature": await sign(secret(), timestamp, body),
            "idempotency-key": eventKey,
          },
          body,
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) error = `n8n answered ${res.status}`;
      } catch (e) {
        error = e instanceof Error ? e.message : "request failed";
      }
    }

    await ctx.runMutation(internal.automation.record, {
      eventKey,
      kind: "request_notification",
      loanId,
      status: error ? "failed" : "sent",
      detail: error ? `attempt ${attempt}: ${error}` : undefined,
    });

    if (error && attempt < MAX_ATTEMPTS) {
      const delayMs = 30_000 * 2 ** (attempt - 1); // 30s, 1m, 2m, 4m
      await ctx.scheduler.runAfter(delayMs, internal.notify.deliver, {
        loanId,
        eventKey,
        attempt: attempt + 1,
      });
    }
  },
});
