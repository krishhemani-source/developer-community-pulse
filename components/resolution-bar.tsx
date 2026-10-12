// Resolved vs unresolved bar. Uses ink tints only (colour is reserved for direction),
// with the unresolved share written out as text.
import { formatShare } from "@/lib/brief";
import type { ResolutionCounts } from "@/lib/metrics";

export function ResolutionBar({ resolution, share }: { resolution: ResolutionCounts; share: number | null }) {
  const resolved = resolution.resolved + resolution.partly_resolved;
  const unresolved = resolution.unresolved + resolution.unanswered;
  const neutral = resolution.no_signal;
  const judged = resolved + unresolved + neutral;

  if (judged === 0) {
    return <span className="text-xs text-muted">Not enough to judge yet</span>;
  }
  const pct = (n: number) => `${(n / judged) * 100}%`;
  return (
    <span className="flex w-full flex-col gap-1">
      <span className="flex h-2 w-full overflow-hidden rounded-sm bg-rule" aria-hidden="true">
        <span className="sf-grow flex h-full w-full">
          <span className="h-full bg-ink" style={{ width: pct(unresolved) }} />
          <span className="h-full bg-ink/25" style={{ width: pct(resolved) }} />
        </span>
      </span>
      <span className="tabular text-xs text-muted">
        <span className="font-medium text-ink">{formatShare(share)}</span> unresolved
        <span className="sr-only">
          : {unresolved} unresolved or unanswered, {resolved} resolved, {neutral} with no unresolved signal
        </span>
      </span>
    </span>
  );
}
