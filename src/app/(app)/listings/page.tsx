"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { message } from "@/lib/errors";
import { ToolForm } from "@/components/tool-form";
import { Badge, Button, Card, Empty, Loading } from "@/components/ui";

export default function ListingsPage() {
  const tools = useQuery(api.tools.mine);
  const create = useMutation(api.tools.create);
  const update = useMutation(api.tools.update);
  const remove = useMutation(api.tools.remove);
  const [editing, setEditing] = useState<Id<"tools"> | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_320px]">
      <section>
        <h1 className="mb-4 text-2xl font-semibold">My listings</h1>
        {error && <p className="mb-3 text-sm text-red-700">{error}</p>}
        {tools === undefined ? (
          <Loading />
        ) : tools.length === 0 ? (
          <Empty>You haven&apos;t listed anything yet.</Empty>
        ) : (
          <div className="space-y-3">
            {tools.map((t) => (
              <Card key={t._id}>
                {editing === t._id ? (
                  <ToolForm
                    initial={t}
                    submitLabel="Save"
                    onCancel={() => setEditing(null)}
                    onSubmit={async (v) => {
                      await update({ toolId: t._id, ...v });
                      setEditing(null);
                    }}
                  />
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-medium">{t.name}</h2>
                        <p className="text-xs text-stone-500">{t.category} · {t.condition}</p>
                      </div>
                      {t.available ? <Badge tone="green">Available</Badge> : <Badge tone="amber">On loan until {t.onLoanUntil}</Badge>}
                    </div>
                    <p className="mt-2 text-sm text-stone-600">{t.description}</p>
                    <div className="mt-3 flex gap-2">
                      <Button variant="secondary" onClick={() => setEditing(t._id)}>Edit</Button>
                      <Button
                        variant="danger"
                        onClick={async () => {
                          if (!confirm(`Delete "${t.name}"? Pending requests will be cancelled.`)) return;
                          setError(null);
                          try {
                            await remove({ toolId: t._id });
                          } catch (e) {
                            setError(message(e));
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>
      <aside>
        <Card>
          <h2 className="mb-3 font-medium">List a tool</h2>
          <ToolForm submitLabel="Add listing" onSubmit={(v) => create(v)} />
        </Card>
      </aside>
    </div>
  );
}
