"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { CATEGORIES, type Category } from "@/lib/constants";
import { RequestForm } from "@/components/request-form";
import { Badge, Button, Card, Empty, Loading } from "@/components/ui";

export default function ToolsPage() {
  const [category, setCategory] = useState<Category | undefined>();
  const tools = useQuery(api.tools.list, { category });
  const [requesting, setRequesting] = useState<Id<"tools"> | null>(null);
  const [sent, setSent] = useState<Id<"tools"> | null>(null);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">All tools</h1>
      <div className="mb-6 flex flex-wrap gap-2">
        {[undefined, ...CATEGORIES].map((c) => (
          <button
            key={c ?? "all"}
            onClick={() => setCategory(c)}
            className={`rounded-full px-3 py-1 text-sm ring-1 ${
              category === c ? "bg-emerald-700 text-white ring-emerald-700" : "bg-white text-stone-700 ring-stone-300 hover:bg-stone-100"
            }`}
          >
            {c ?? "All"}
          </button>
        ))}
      </div>

      {tools === undefined ? (
        <Loading />
      ) : tools.length === 0 ? (
        <Empty>No tools in this category yet.</Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {tools.map((t) => (
            <Card key={t._id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-medium">{t.name}</h2>
                  <p className="text-xs text-stone-500">
                    {t.category} · {t.condition} · lent by {t.isMine ? "you" : t.ownerName}
                    {t.ownerTrusted && " "}
                    {t.ownerTrusted && <Badge tone="blue">Trusted Lender</Badge>}
                  </p>
                </div>
                {t.available ? <Badge tone="green">Available</Badge> : <Badge tone="amber">On loan until {t.onLoanUntil}</Badge>}
              </div>
              <p className="mt-2 text-sm text-stone-600">{t.description}</p>
              {!t.isMine &&
                (requesting === t._id ? (
                  <RequestForm
                    toolId={t._id}
                    onDone={() => {
                      setRequesting(null);
                      setSent(t._id);
                    }}
                  />
                ) : (
                  <div className="mt-3 flex items-center gap-3">
                    <Button variant="secondary" onClick={() => { setRequesting(t._id); setSent(null); }}>
                      Request to borrow
                    </Button>
                    {sent === t._id && <span className="text-xs text-emerald-700">Request sent</span>}
                  </div>
                ))}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
