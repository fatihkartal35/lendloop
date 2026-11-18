"use client";

import { useState } from "react";
import { CATEGORIES, CONDITIONS, type Category, type Condition } from "@/lib/constants";
import { message } from "@/lib/errors";
import { Button, inputClass } from "./ui";

export type ToolInput = { name: string; category: Category; condition: Condition; description: string };

export function ToolForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: ToolInput;
  submitLabel: string;
  onSubmit: (v: ToolInput) => Promise<unknown>;
  onCancel?: () => void;
}) {
  const [v, setV] = useState<ToolInput>(
    initial ?? { name: "", category: "power tools", condition: "good", description: "" },
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit(v);
      if (!initial) setV({ name: "", category: v.category, condition: "good", description: "" });
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input className={inputClass} placeholder="Name, e.g. Cordless drill" maxLength={80} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} required />
      <div className="grid grid-cols-2 gap-2">
        <select className={inputClass} value={v.category} onChange={(e) => setV({ ...v, category: e.target.value as Category })}>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select className={inputClass} value={v.condition} onChange={(e) => setV({ ...v, condition: e.target.value as Condition })}>
          {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <textarea className={inputClass} rows={2} placeholder="Short description" maxLength={500} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} required />
      {error && <p className="text-xs text-red-700">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>{submitLabel}</Button>
        {onCancel && <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>}
      </div>
    </form>
  );
}
