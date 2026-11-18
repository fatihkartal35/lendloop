"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { message } from "@/lib/errors";
import { Button, inputClass } from "./ui";

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function RequestForm({ toolId, onDone }: { toolId: Id<"tools">; onDone: () => void }) {
  const request = useMutation(api.loans.request);
  const [today] = useState(() => iso(new Date()));
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(() => iso(new Date(Date.now() + 2 * 86_400_000)));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await request({ toolId, startDate: start, endDate: end });
      onDone();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-2 border-t border-stone-100 pt-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-stone-500">
          From
          <input type="date" className={inputClass} min={today} value={start} onChange={(e) => setStart(e.target.value)} required />
        </label>
        <label className="text-xs text-stone-500">
          Until
          <input type="date" className={inputClass} min={start} value={end} onChange={(e) => setEnd(e.target.value)} required />
        </label>
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>Send request</Button>
        <Button type="button" variant="secondary" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}
