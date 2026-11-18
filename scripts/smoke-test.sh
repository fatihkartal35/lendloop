#!/usr/bin/env bash
# End-to-end smoke test against the local Convex deployment and n8n.
# Needs: `npx convex dev` running, `docker compose up -d`, and
# `npx convex env set ALLOW_TEST_HELPERS true` (dev only).
set -euo pipefail
cd "$(dirname "$0")/.."

run() { npx convex run --identity "$1" "${@:2}" </dev/null 2>&1 | tail -1; }
expect_error() {
  local out; out=$(npx convex run --identity "$1" "${@:2}" </dev/null 2>&1 || true)
  local msg; msg=$(grep -m1 -o 'ConvexError: .*' <<<"$out" || true)
  if [[ -n "$msg" ]]; then echo "  ok   refused: ${msg#ConvexError: } (${2})"; else echo "  FAIL allowed: ${2} -> $(tail -1 <<<"$out")"; exit 1; fi
}

TAG=$RANDOM
LENDER="{\"subject\":\"lender-$TAG\",\"issuer\":\"https://smoke\",\"name\":\"Lena\",\"email\":\"lena-$TAG@example.com\"}"
BORROWER="{\"subject\":\"borrower-$TAG\",\"issuer\":\"https://smoke\",\"name\":\"Bo\",\"email\":\"bo-$TAG@example.com\"}"
run "$LENDER" users:store >/dev/null
run "$BORROWER" users:store >/dev/null

TOOL=$(run "$LENDER" tools:create '{"name":"Cordless drill","category":"power tools","condition":"good","description":"18V, two batteries"}' | tr -d '"')
TODAY=$(date -u +%F)
END=$(date -u -v+2d +%F 2>/dev/null || date -u -d '+2 days' +%F)
LOAN=$(run "$BORROWER" loans:request "{\"toolId\":\"$TOOL\",\"startDate\":\"$TODAY\",\"endDate\":\"$END\"}" | tr -d '"')
echo "tool $TOOL, loan $LOAN"

echo "RBAC (enforced in Convex, not the UI):"
expect_error "$BORROWER" loans:decide "{\"loanId\":\"$LOAN\",\"approve\":true}"
expect_error "$BORROWER" tools:update "{\"toolId\":\"$TOOL\",\"name\":\"x\",\"category\":\"garden\",\"condition\":\"good\",\"description\":\"x\"}"
expect_error "$BORROWER" tools:remove "{\"toolId\":\"$TOOL\"}"
expect_error "$BORROWER" users:listForAdmin
expect_error "$LENDER" loans:request "{\"toolId\":\"$TOOL\",\"startDate\":\"$TODAY\",\"endDate\":\"$END\"}"
expect_error "$LENDER" loans:markReturned "{\"loanId\":\"$LOAN\"}"

echo "Approve, then backdate so the loan is overdue:"
run "$LENDER" loans:decide "{\"loanId\":\"$LOAN\",\"approve\":true}" >/dev/null
PAST_START=$(date -u -v-5d +%F 2>/dev/null || date -u -d '-5 days' +%F)
PAST_END=$(date -u -v-2d +%F 2>/dev/null || date -u -d '-2 days' +%F)
npx convex run testing:backdateLoan "{\"loanId\":\"$LOAN\",\"startDate\":\"$PAST_START\",\"endDate\":\"$PAST_END\"}" </dev/null >/dev/null
sleep 3
echo "$LOAN" > .smoke-loan-id
echo "Done. Now run the overdue workflow (n8n 'Run now') and check the loan's activity."
