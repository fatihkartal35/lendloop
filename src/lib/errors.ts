import { ConvexError } from "convex/values";

export function message(e: unknown): string {
  if (e instanceof ConvexError) return String(e.data);
  return "Something went wrong. Please try again.";
}
