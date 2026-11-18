"use client";

import { useState } from "react";
import { message } from "./errors";

/** Runs a mutation and keeps its error message for display. */
export function useRun() {
  const [error, setError] = useState<string | null>(null);
  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(message(e));
    }
  }
  return { error, run };
}
