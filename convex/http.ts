import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { secret, verify } from "./lib/hmac";

const http = httpRouter();

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

async function authorized(req: Request, body: string) {
  return verify(
    secret(),
    req.headers.get("x-lendloop-timestamp"),
    req.headers.get("x-lendloop-signature"),
    body,
  );
}

// n8n daily job: fetch loans that are overdue and not yet reminded today.
http.route({
  path: "/n8n/overdue-loans",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    if (!(await authorized(req, ""))) return json({ error: "invalid signature" }, 401);
    return json(await ctx.runQuery(internal.automation.overdueLoans, {}));
  }),
});

// n8n writes back whether each reminder went out. Safe to retry.
http.route({
  path: "/n8n/reminder-status",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const raw = await req.text();
    if (!(await authorized(req, raw))) return json({ error: "invalid signature" }, 401);
    let body: { eventKey?: unknown; loanId?: unknown; status?: unknown; detail?: unknown };
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ error: "invalid json" }, 400);
    }
    const { eventKey, loanId, status, detail } = body;
    if (
      typeof eventKey !== "string" ||
      typeof loanId !== "string" ||
      !eventKey.startsWith(`overdue:${loanId}:`) ||
      (status !== "sent" && status !== "failed")
    ) {
      return json({ error: "invalid payload" }, 400);
    }
    const result = await ctx.runMutation(internal.automation.record, {
      eventKey,
      kind: "overdue_reminder",
      loanId,
      status,
      detail: typeof detail === "string" ? detail : undefined,
    });
    return json(result, result.ok ? 200 : 404);
  }),
});

// n8n error workflow reports failed executions so they show up in the admin view.
http.route({
  path: "/n8n/workflow-error",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const raw = await req.text();
    if (!(await authorized(req, raw))) return json({ error: "invalid signature" }, 401);
    let body: { executionId?: unknown; workflow?: unknown; node?: unknown; message?: unknown };
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ error: "invalid json" }, 400);
    }
    const executionId = String(body.executionId ?? "unknown");
    await ctx.runMutation(internal.automation.record, {
      eventKey: `error:${executionId}`,
      kind: "workflow_error",
      status: "failed",
      detail: `${String(body.workflow ?? "?")} / ${String(body.node ?? "?")}: ${String(body.message ?? "")}`,
    });
    return json({ ok: true });
  }),
});

export default http;
