"use client";

import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Header } from "@/components/header";
import { Badge, Empty, Loading } from "@/components/ui";

export default function Home() {
  const tools = useQuery(api.tools.listPublic);
  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-12">
        <section className="mb-12 max-w-xl">
          <h1 className="text-4xl font-semibold tracking-tight">Borrow what you need. Lend what you don&apos;t.</h1>
          <p className="mt-3 text-stone-600">
            A lending board for neighbors. List the tools sitting in your shed, borrow the ones you need for a weekend.
          </p>
          <div className="mt-6">
            <Unauthenticated>
              <SignInButton mode="modal">
                <button className="rounded-lg bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800">
                  Sign in to lend or borrow
                </button>
              </SignInButton>
            </Unauthenticated>
            <Authenticated>
              <Link href="/tools" className="rounded-lg bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800">
                Open the board
              </Link>
            </Authenticated>
          </div>
        </section>

        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-stone-500">Available now</h2>
        {tools === undefined ? (
          <Loading />
        ) : tools.length === 0 ? (
          <Empty>No tools listed yet. Be the first to lend one.</Empty>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((t) => (
              <li key={t._id} className="flex items-center justify-between rounded-xl bg-white px-4 py-3 ring-1 ring-stone-200">
                <span className="font-medium">{t.name}</span>
                <Badge>{t.category}</Badge>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
