"use client";

import type { ReactNode } from "react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import { timeAgo } from "@/lib/constants";
import { Badge, Card } from "./ui";

export type Loan = FunctionReturnType<typeof api.loans.myRequests>[number];

const STATUS_TONE = {
  pending: "amber",
  approved: "green",
  declined: "red",
  cancelled: "stone",
  returned: "blue",
} as const;

const ACTIVITY_LABEL = {
  request_notification: "Notification",
  overdue_reminder: "Overdue reminder",
  workflow_error: "Automation error",
} as const;

export function LoanCard({ loan, subtitle, actions }: { loan: Loan; subtitle: string; actions?: ReactNode }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-medium">{loan.toolName}</h2>
          <p className="text-xs text-stone-500">
            {subtitle} · {loan.startDate} → {loan.endDate}
          </p>
        </div>
        <div className="flex gap-1">
          {loan.overdue && <Badge tone="red">Overdue</Badge>}
          <Badge tone={STATUS_TONE[loan.status]}>{loan.status}</Badge>
        </div>
      </div>
      {loan.activity.length > 0 && (
        <ul className="mt-3 space-y-0.5 border-t border-stone-100 pt-2 text-xs text-stone-500">
          {loan.activity.map((a, i) => (
            <li key={i}>
              {ACTIVITY_LABEL[a.kind]} {a.status === "sent" ? "sent" : "failed"} {timeAgo(a.updatedAt)}
            </li>
          ))}
        </ul>
      )}
      {actions && <div className="mt-3 flex gap-2">{actions}</div>}
    </Card>
  );
}
