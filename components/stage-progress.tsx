// Live stage display: Collecting → Cleaning → Tagging → Measuring → Writing → Verifying → Sending.
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const STAGE_LABELS: { key: string; label: string }[] = [
  { key: "collecting", label: "Collecting" },
  { key: "cleaning", label: "Cleaning" },
  { key: "tagging", label: "Tagging" },
  { key: "measuring", label: "Measuring" },
  { key: "writing", label: "Writing" },
  { key: "verifying", label: "Verifying" },
  { key: "sending", label: "Sending" },
];

export function StageProgress({ stage, showSending = true }: { stage: string; showSending?: boolean }) {
  const stages = showSending ? STAGE_LABELS : STAGE_LABELS.filter((s) => s.key !== "sending");
  const current = stages.findIndex((s) => s.key === stage);
  const done = stage === "done";
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-1 text-xs" aria-label="Run progress">
      {stages.map((s, i) => {
        const state = done || i < current ? "done" : i === current ? "active" : "todo";
        return (
          <li key={s.key} className="flex items-center gap-1">
            {i > 0 && (
              <span aria-hidden="true" className="text-rule">
                /
              </span>
            )}
            <span
              aria-current={state === "active" ? "step" : undefined}
              className={cn(
                "inline-flex items-center gap-1 rounded px-1.5 py-0.5",
                state === "done" && "text-muted",
                state === "active" && "bg-ink font-medium text-paper",
                state === "todo" && "text-muted/60",
              )}
            >
              {state === "done" && <Check aria-hidden="true" className="size-3" />}
              {s.label}
              {state === "active" && <span className="sr-only"> (in progress)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
