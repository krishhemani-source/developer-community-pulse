// Small, neutral source marks. Text label always accompanies the icon.
import { BookOpenText, CircleDot, MessagesSquare, SquareCode } from "lucide-react";
import { SOURCE_LABELS, type SourceName } from "@/lib/collectors/types";
import { RESOLUTION_LABELS, type Resolution } from "@/lib/metrics";
import { cn } from "@/lib/utils";

const ICONS = { hackernews: MessagesSquare, stackoverflow: SquareCode, github: CircleDot, devto: BookOpenText };

export function SourceLabel({ source, className }: { source: SourceName; className?: string }) {
  const Icon = ICONS[source];
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs text-muted", className)}>
      <Icon aria-hidden="true" className="size-3.5" />
      {SOURCE_LABELS[source]}
    </span>
  );
}

export function ResolutionLabel({ resolution }: { resolution: Resolution }) {
  const strong = resolution === "unresolved" || resolution === "unanswered";
  return <span className={cn("text-xs", strong ? "font-medium text-ink" : "text-muted")}>{RESOLUTION_LABELS[resolution]}</span>;
}
