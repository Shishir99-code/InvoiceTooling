"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// App-level top nav (D-02): five flat destinations — Students / Dashboard /
// Sessions / History / Settings. Archived is intentionally NOT a separate
// item here; it stays nested as the existing sub-tab pair under the
// Students page content.
const NAV_ITEMS = [
  { href: "/", label: "Students" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/sessions", label: "Sessions" },
  { href: "/history", label: "History" },
  { href: "/settings", label: "Settings" },
] as const;

export function TopNav() {
  const pathname = usePathname();

  return (
    <div className="mx-auto w-full max-w-3xl px-4">
      <div className="flex gap-6 border-b border-zinc-200">
        {NAV_ITEMS.map((item) => {
          // Students is active for both "/" and "/archived" — Archived is a
          // nested sub-tab under Students, not a separate top-level route.
          const isActive =
            item.href === "/"
              ? pathname === "/" || pathname === "/archived"
              : pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                isActive
                  ? "-mb-px border-b-2 border-primary pb-2 text-base font-medium text-primary"
                  : "border-b-2 border-transparent pb-2 text-base font-medium text-zinc-600 hover:text-zinc-900"
              }
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
