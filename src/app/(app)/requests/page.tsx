"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useRun } from "@/lib/use-action-error";
import { LoanCard } from "@/components/loan-card";
import { Button, Empty, Loading } from "@/components/ui";

export default function MyRequestsPage() {
  const loans = useQuery(api.loans.myRequests);
  const cancel = useMutation(api.loans.cancel);
  const { error, run } = useRun();

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">My requests</h1>
      {error && <p className="mb-3 text-sm text-red-700">{error}</p>}
      {loans === undefined ? (
        <Loading />
      ) : loans.length === 0 ? (
        <Empty>You haven&apos;t asked to borrow anything yet.</Empty>
      ) : (
        <div className="space-y-3">
          {loans.map((l) => (
            <LoanCard
              key={l._id}
              loan={l}
              subtitle={`from ${l.lenderName}`}
              actions={
                l.status === "pending" && (
                  <Button variant="secondary" onClick={() => run(() => cancel({ loanId: l._id }))}>
                    Cancel request
                  </Button>
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
