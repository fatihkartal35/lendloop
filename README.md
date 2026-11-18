# LendLoop

Borrow what you need. Lend what you don't.

LendLoop is a lending board for neighbors. People list the tools they own, ask to borrow each other's tools for a set of dates, and get automated notifications and reminders through n8n.

**Stack:** Next.js 16 (App Router), Clerk, Convex, n8n, TypeScript, Tailwind.

## Run it locally

You need:
- Node 20 or newer.
- Docker, for n8n.
- A free Clerk account.

### 1. Install and start Convex

```bash
npm install
npx convex dev            # creates a dev deployment and writes .env.local
```

Leave the `npx convex dev` process running in its own terminal.

### 2. Set up Clerk

1. Create an application in the Clerk dashboard.
2. Open **Integrations → Convex** and activate it. Clerk then issues session tokens with `aud: "convex"`.
3. Add the Clerk keys to `.env.local`. They are listed in `.env.example`.
4. Copy the Frontend API URL from the dashboard and give it to Convex:

```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://<your-instance>.clerk.accounts.dev
```

### 3. Set the Convex environment variables

```bash
npx convex env set ADMIN_EMAILS you@example.com      # comma-separated admin allow-list
npx convex env set N8N_SHARED_SECRET "$(openssl rand -hex 32)"
npx convex env set N8N_REQUEST_WEBHOOK_URL http://127.0.0.1:5678/webhook/lendloop-request
```

### 4. Start n8n with the workflows

```bash
cp .env.n8n.example .env.n8n.local
# Paste the same secret into .env.n8n.local. To read it back:
#   npx convex env get N8N_SHARED_SECRET
docker compose run --rm n8n import:workflow --separate --input=/workflows
docker compose run --rm n8n publish:workflow --id=lendloopRequest1
docker compose run --rm n8n publish:workflow --id=lendloopOverdue1
docker compose up -d
```

The n8n editor is at http://localhost:5678. Create the local owner account the first time you open it.

If Convex is not on `127.0.0.1:3211`, set `CONVEX_SITE_URL` before running `docker compose up`. When you self-host Convex, the URL is the `NEXT_PUBLIC_CONVEX_SITE_URL` value as seen from inside the container.

### 5. Start the app

```bash
npm run dev               # http://localhost:3000
```

### Smoke test

`scripts/smoke-test.sh` runs against the local Convex deployment. It does not need a browser or Clerk; it uses `convex run --identity`. The script:
- Creates two users, a tool and a borrow request.
- Checks that the borrower is refused for six actions they are not allowed to do.
- Approves the loan, then backdates it so it counts as overdue.

The backdating only works when you have run `npx convex env set ALLOW_TEST_HELPERS true`. Never set it in production.

## Environment variables

| Where | Name | What it is |
|---|---|---|
| `.env.local` (Next.js) | `NEXT_PUBLIC_CONVEX_URL` | Written by `npx convex dev` |
| `.env.local` (Next.js) | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | From the Clerk dashboard |
| Convex | `CLERK_JWT_ISSUER_DOMAIN` | Clerk Frontend API URL |
| Convex | `ADMIN_EMAILS` | Users with these verified emails become admins on sign-in |
| Convex | `N8N_SHARED_SECRET` | HMAC key shared with n8n |
| Convex | `N8N_REQUEST_WEBHOOK_URL` | Production URL of the request-notification webhook |
| Convex | `ALLOW_TEST_HELPERS` | Dev only, enables `testing:backdateLoan` |
| `.env.n8n.local` (n8n) | `LENDLOOP_SHARED_SECRET` | Same value as `N8N_SHARED_SECRET` |
| docker-compose | `CONVEX_SITE_URL` | Convex HTTP actions URL as n8n sees it |

## Architecture

```
Browser ──Clerk session──▶ Next.js (UI only)
   │
   └──Convex client (Clerk JWT)──▶ Convex queries/mutations ── all rules enforced here
                                        │
                                        │ scheduler (after commit)
                                        ▼
                         notify.deliver action ──HMAC-signed POST──▶ n8n "Request notifications"
                                                                       verify → dedupe → notify → 200

n8n "Overdue reminders" (daily 09:00)
   ──signed GET──▶ Convex /n8n/overdue-loans
   ──signed POST per loan──▶ Convex /n8n/reminder-status (idempotent)

n8n "Error handler" (error workflow of both)
   ──signed POST──▶ Convex /n8n/workflow-error ──▶ shown on the Admin page
```

**Data model:** four tables in `convex/schema.ts`:
- `users`: name, email, role, Trusted Lender flag.
- `tools`.
- `loans`: tool, lender, borrower, date range, status.
- `automationEvents`: one row for each notification, reminder or workflow error, keyed by `eventKey`.

**Loan lifecycle:**

```
pending ──approve──▶ approved ──mark returned──▶ returned
   │                    (overdue once endDate < today)
   ├──decline──▶ declined
   └──cancel───▶ cancelled
```

**Screens:**
- Public board.
- All tools, with a category filter.
- My listings.
- My requests.
- Incoming requests.
- Admin: users and Trusted Lender, every listing, every loan, automation failures.

Each loan card shows its recent automation activity, for example "Overdue reminder sent 2 h ago".

## Security and data-minimization decisions

**Authorization lives in Convex.**
- Every public query and mutation reads the caller from the verified Clerk token (`convex/lib/auth.ts`) and checks ownership or role on the server. The UI hides buttons only as a convenience.
- Examples of what Convex enforces:
  - Only the lender can approve, decline or mark a loan as returned.
  - Only the borrower can cancel a request.
  - Owners edit only their own listings.
  - Admins can remove any listing, but they cannot edit someone else's.
- The Next.js `proxy.ts` only redirects signed-out users. It is not the security boundary.

**Admin role from an allow-list.** The `admin` role comes from the `ADMIN_EMAILS` server env var when the user signs in. A client can never send a role.

**Input checks.**
- Lengths are capped.
- Categories and conditions are enums.
- Dates must be valid, cannot be in the past, and a loan lasts at most 30 days.
- An approved loan cannot overlap another approved loan for the same tool.
- A borrower can have only one pending request per tool.

**Public board.** It returns only a tool's name and category. The owner's name, the description and the condition are visible only after sign-in. Email addresses appear only on the admin page.

**Data sent to n8n.**
- Webhook payloads carry only what a notification needs: the event, the recipient's name and email, the other person's first name, the tool name and the dates.
- Descriptions and user IDs are never sent.
- `/n8n/overdue-loans` returns the same minimal shape.

**Signed in both directions.**
- Every Convex → n8n and n8n → Convex call carries `x-lendloop-timestamp` and `x-lendloop-signature`. The signature is HMAC-SHA256 over `timestamp.body`.
- The receiver checks the signature with a constant-time comparison and rejects timestamps older than 5 minutes, which limits replay.
- n8n verifies the raw request body, not a re-serialized copy.

**Secrets.**
- The shared secret is in Convex env and in n8n's container env (`$env.LENDLOOP_SHARED_SECRET`).
- The exported workflow JSON has no secrets and no credentials. Run `grep -i secret n8n/workflows/*.json` and you only find the env lookup.
- `.env*` files are git-ignored, except the example files.

**Idempotency.**
- Each automation has a deterministic `eventKey`: `notify:<loan>:<status>` or `overdue:<loan>:<date>`.
- `automation.record` upserts by that key and never turns a `sent` row back into `failed`, so a retried write-back is a no-op.
- `/n8n/overdue-loans` skips loans that were already reminded today, so running the reminder workflow twice sends nothing new.
- The n8n webhook also drops duplicate `eventKey`s (workflow static data), in case Convex retries after n8n already handled the event.

**Failures are visible.**
- Convex retries a failed webhook delivery up to 5 times with exponential backoff (30 s to 4 min), and records every attempt.
- The n8n HTTP nodes retry 3 times.
- Both n8n workflows use the error workflow, which reports the failed execution to Convex.
- Failures appear on the Admin page.

## What I'd change for production

**Notifications**
- Replace the mock notification Code nodes with a real email provider, such as an SMTP or Resend credential in n8n.
- Add an unsubscribe and preferences table.

**Webhook delivery**
- Move delivery to a durable outbox table, so a crash between commit and scheduling can't lose an event. Convex's scheduler is transactional with the mutation, but an outbox also gives one place to replay events from.
- Keep a small "seen nonces" table on the receiving side as well as the 5-minute window, to block replays inside that window.
- Rotate `N8N_SHARED_SECRET` with a key ID header, so old and new secrets both work during a rotation.

**n8n**
- Run n8n with Postgres and queue mode instead of SQLite.
- Put it behind TLS on a private network, with the webhook path not guessable.
- Pin the image digest.

**Auth and admin**
- Move admin management into Clerk roles or organizations and drop the email allow-list.
- Add an audit log for admin actions (listing removals, Trusted Lender changes).

**Data and app**
- Store dates as dates in the user's timezone. Today "overdue" is computed in UTC.
- Add pagination for big neighborhoods. Lists are capped at 100 to 200 rows today.
- Add rate limits on requests per user.
- Add Playwright tests for the main flows.
- Run lint, type-check and the smoke test in CI.
- Add Sentry for both the app and the Convex functions.

## How I built it

I built this with Claude Code. I chose the data model, the security approach and the tests, then checked everything end to end against a local Convex deployment and n8n in Docker:
- the role checks;
- signed delivery and the n8n webhook rejecting bad signatures;
- the overdue reminder write-back, and that it doesn't send twice;
- Convex retrying while n8n was down.
