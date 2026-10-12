// shadcn/ui Badge, restyled: small, sentence case, never colour alone.
import { cn } from "@/lib/utils";

export function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded border border-rule px-1.5 py-0.5 text-xs text-muted", className)}>
      {children}
    </span>
  );
}
