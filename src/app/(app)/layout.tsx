"use client";

import { AuthLoading, Authenticated, Unauthenticated } from "convex/react";
import { SignInButton } from "@clerk/nextjs";
import { Header } from "@/components/header";
import { Loading } from "@/components/ui";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <AuthLoading>
          <Loading />
        </AuthLoading>
        <Authenticated>{children}</Authenticated>
        <Unauthenticated>
          <div className="py-16 text-center">
            <SignInButton mode="modal">
              <button className="rounded-lg bg-emerald-700 px-4 py-2 font-medium text-white">Sign in to continue</button>
            </SignInButton>
          </div>
        </Unauthenticated>
      </main>
    </>
  );
}
