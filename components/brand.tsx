// SignalForge brand: the signal mark and the wordmark.
// The mark is two concentric signal rings around a central point. The outer ring is broken,
// like a signal being picked up; the point is the one thing worth acting on, in electric violet.
import Link from "next/link";
import { cn } from "@/lib/utils";

export const BRAND = {
  name: "SignalForge",
  descriptor: "Developer Intelligence",
  tagline: "Turn developer noise into product direction.",
  brief: "Weekly Intelligence Brief",
} as const;

export function SignalMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" className={cn("shrink-0", className)}>
      {/* outer ring: broken, picked-up signal */}
      <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="58 24" transform="rotate(-52 16 16)" opacity="0.4" />
      {/* inner ring */}
      <circle cx="16" cy="16" r="8" stroke="currentColor" strokeWidth="2" opacity="0.85" />
      {/* the signal */}
      <circle cx="16" cy="16" r="3.4" fill="var(--accent)" />
    </svg>
  );
}

export function Wordmark({ className, descriptor = true }: { className?: string; descriptor?: boolean }) {
  return (
    <Link href="/" className={cn("group flex items-center gap-2.5", className)} aria-label={`${BRAND.name}, ${BRAND.descriptor}: home`}>
      <SignalMark className="text-ink transition-transform group-hover:rotate-12" />
      <span className="leading-tight">
        <span className="block text-[15px] font-semibold tracking-[-0.01em]">
          Signal<span className="text-accent">Forge</span>
        </span>
        {descriptor && <span className="block text-[11px] text-muted">{BRAND.descriptor}</span>}
      </span>
    </Link>
  );
}
