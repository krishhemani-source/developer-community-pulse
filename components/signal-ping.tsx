// A small "signal" status: a solid point with rings rippling out. Used only while something is live.
import { cn } from "@/lib/utils";

export function SignalPing({ className, tone = "accent" }: { className?: string; tone?: "accent" | "paper" }) {
  const color = tone === "accent" ? "bg-accent" : "bg-on-accent";
  return (
    <span aria-hidden="true" className={cn("relative inline-flex size-2.5 shrink-0 items-center justify-center", className)}>
      <span className={cn("sf-ripple absolute inset-0 rounded-full", color)} />
      <span className={cn("sf-ripple absolute inset-0 rounded-full [animation-delay:600ms]", color)} />
      <span className={cn("relative size-1.5 rounded-full", color)} />
    </span>
  );
}
