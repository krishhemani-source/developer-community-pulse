"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Brief" },
  { href: "/history", label: "History" },
  { href: "/runs", label: "Run log" },
  { href: "/settings", label: "Settings" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main">
      <ul className="flex items-center gap-1 text-sm">
        {LINKS.map((l) => {
          const active = l.href === "/" ? pathname === "/" || pathname.startsWith("/topics") : pathname.startsWith(l.href);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cn("rounded px-2.5 py-1.5", active ? "bg-ink text-paper" : "text-muted hover:text-ink")}
              >
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
