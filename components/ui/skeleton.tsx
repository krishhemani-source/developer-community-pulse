// shadcn/ui Skeleton. The pulse animation is disabled for users who prefer reduced motion (globals.css).
import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded bg-rule/70", className)} />;
}
