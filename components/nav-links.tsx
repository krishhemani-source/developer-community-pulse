"use client";
import { Activity, BookOpen, History, LayoutDashboard, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Intelligence Brief", short: "Brief", icon: LayoutDashboard },
  { href: "/history", label: "Brief archive", short: "Archive", icon: History },
  { href: "/runs", label: "Run log", short: "Runs", icon: Activity },
  { href: "/settings", label: "Settings", short: "Settings", icon: SlidersHorizontal },
  { href: "/about", label: "How it works", short: "About", icon: BookOpen },
];

export function NavLinks({ orientation, className }: { orientation: "vertical" | "horizontal"; className?: string }) {
  const pathname = usePathname();
  const vertical = orientation === "vertical";
  return (
    <nav aria-label="Main" className={className}>
      <ul className={cn("text-sm", vertical ? "flex flex-col gap-1" : "flex items-center gap-1")}>
        {LINKS.map((l) => {
          const active = l.href === "/" ? pathname === "/" || pathname.startsWith("/topics") : pathname.startsWith(l.href);
          const Icon = l.icon;
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-md transition-colors",
                  vertical ? "px-2.5 py-2" : "px-2.5 py-1.5",
                  active ? "bg-accent-soft font-medium text-ink" : "text-muted hover:bg-ink/[0.04] hover:text-ink",
                )}
              >
                <Icon aria-hidden="true" className={cn("size-4", active ? "text-accent" : "")} />
                <span className={vertical ? "" : "hidden sm:inline"}>{vertical ? l.label : l.short}</span>
                {!vertical && <span className="sr-only sm:hidden">{l.label}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
