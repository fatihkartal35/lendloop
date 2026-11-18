"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { timeAgo } from "@/lib/constants";
import { useRun } from "@/lib/use-action-error";
import { LoanCard } from "@/components/loan-card";
import { Badge, Button, Card, Empty, Loading } from "@/components/ui";

export default function AdminPage() {
  const viewer = useQuery(api.users.viewer);
  if (viewer === undefined) return <Loading />;
  if (viewer?.role !== "admin") return <Empty>This page is for admins.</Empty>;
  return <AdminView />;
}

function AdminView() {
  const users = useQuery(api.users.listForAdmin);
  const tools = useQuery(api.tools.list, {});
  const loans = useQuery(api.loans.all);
  const failures = useQuery(api.automation.recentFailures);
  const setTrusted = useMutation(api.users.setTrustedLender);
  const remove = useMutation(api.tools.remove);
  const { error, run } = useRun();

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-semibold">Admin</h1>
      {error && <p className="text-sm text-red-700">{error}</p>}

      <section>
        <h2 className="mb-3 font-medium">Automation failures</h2>
        {failures === undefined ? (
          <Loading />
        ) : failures.length === 0 ? (
          <Empty>No failed automations.</Empty>
        ) : (
          <Card className="divide-y divide-stone-100 p-0">
            {failures.map((f) => (
              <div key={f._id} className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm">
                <Badge tone="red">{f.kind.replace("_", " ")}</Badge>
                <span className="flex-1 text-stone-600">{f.detail}</span>
                <span className="text-xs text-stone-400">
                  {f.attempts} attempt{f.attempts === 1 ? "" : "s"} · {timeAgo(f.at)}
                </span>
              </div>
            ))}
          </Card>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-medium">Users</h2>
        {users === undefined ? (
          <Loading />
        ) : (
          <Card className="divide-y divide-stone-100 p-0">
            {users.map((u) => (
              <div key={u._id} className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm">
                <span className="font-medium">{u.name}</span>
                <span className="text-stone-500">{u.email}</span>
                {u.role === "admin" && <Badge>admin</Badge>}
                {u.trustedLender && <Badge tone="blue">Trusted Lender</Badge>}
                <Button
                  variant="secondary"
                  className="ml-auto"
                  onClick={() => run(() => setTrusted({ userId: u._id, trusted: !u.trustedLender }))}
                >
                  {u.trustedLender ? "Remove Trusted" : "Mark Trusted"}
                </Button>
              </div>
            ))}
          </Card>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-medium">All listings</h2>
        {tools === undefined ? (
          <Loading />
        ) : tools.length === 0 ? (
          <Empty>No listings.</Empty>
        ) : (
          <Card className="divide-y divide-stone-100 p-0">
            {tools.map((t) => (
              <div key={t._id} className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm">
                <span className="font-medium">{t.name}</span>
                <span className="text-stone-500">{t.category} · {t.ownerName}</span>
                <Button
                  variant="danger"
                  className="ml-auto"
                  onClick={() => {
                    if (confirm(`Remove "${t.name}"? Open requests and loans for it will be cancelled.`)) {
                      void run(() => remove({ toolId: t._id }));
                    }
                  }}
                >
                  Remove
                </Button>
              </div>
            ))}
          </Card>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-medium">All loans</h2>
        {loans === undefined ? (
          <Loading />
        ) : loans.length === 0 ? (
          <Empty>No loans yet.</Empty>
        ) : (
          <div className="space-y-3">
            {loans.map((l) => (
              <LoanCard key={l._id} loan={l} subtitle={`${l.borrowerName} from ${l.lenderName}`} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
