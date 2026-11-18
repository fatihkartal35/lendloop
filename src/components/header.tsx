"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignInButton, UserButton } from "@clerk/nextjs";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

const LINKS = [
  { href: "/tools", label: "All tools" },
  { href: "/listings", label: "My listings" },
  { href: "/requests", label: "My requests" },
  { href: "/incoming", label: "Incoming requests" },
];

function Nav() {
  const pathname = usePathname();
  const viewer = useQuery(api.users.viewer);
  const links = viewer?.role === "admin" ? [...LINKS, { href: "/admin", label: "Admin" }] : LINKS;
  return (
    <nav className="flex gap-1 overflow-x-auto text-sm">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`whitespace-nowrap rounded-lg px-3 py-1.5 ${
            pathname.startsWith(l.href) ? "bg-emerald-50 font-medium text-emerald-800" : "text-stone-600 hover:bg-stone-100"
          }`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

export function Header() {
  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
        <Link href="/" className="mr-2 text-lg font-semibold tracking-tight">
          Lend<span className="text-emerald-700">Loop</span>
        </Link>
        <Authenticated>
          <div className="order-last w-full sm:order-none sm:w-auto sm:flex-1">
            <Nav />
          </div>
          <div className="ml-auto">
            <UserButton />
          </div>
        </Authenticated>
        <Unauthenticated>
          <div className="ml-auto">
            <SignInButton mode="modal">
              <button className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800">
                Sign in to lend or borrow
              </button>
            </SignInButton>
          </div>
        </Unauthenticated>
      </div>
    </header>
  );
}
