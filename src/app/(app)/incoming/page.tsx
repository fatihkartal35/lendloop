"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useRun } from "@/lib/use-action-error";
import { LoanCard } from "@/components/loan-card";
import { Button, Empty, Loading } from "@/components/ui";

export default function IncomingPage() {
  const loans = useQuery(api.loans.incoming);
  const decide = useMutation(api.loans.decide);
  const markReturned = useMutation(api.loans.markReturned);
  const { error, run } = useRun();

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Incoming requests</h1>
      {error && <p className="mb-3 text-sm text-red-700">{error}</p>}
      {loans === undefined ? (
        <Loading />
      ) : loans.length === 0 ? (
        <Empty>Nobody has asked to borrow your tools yet.</Empty>
      ) : (
        <div className="space-y-3">
          {loans.map((l) => (
            <LoanCard
              key={l._id}
              loan={l}
              subtitle={`for ${l.borrowerName}`}
              actions={
                l.status === "pending" ? (
                  <>
                    <Button onClick={() => run(() => decide({ loanId: l._id, approve: true }))}>Approve</Button>
                    <Button variant="secondary" onClick={() => run(() => decide({ loanId: l._id, approve: false }))}>
                      Decline
                    </Button>
                  </>
                ) : l.status === "approved" ? (
                  <Button variant="secondary" onClick={() => run(() => markReturned({ loanId: l._id }))}>
                    Mark as returned
                  </Button>
                ) : null
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
