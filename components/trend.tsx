// Trend marks: arrow + text + colour together, so colour is never the only signal.
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { TREND_TEXT, formatDelta } from "@/lib/brief";
import type { TrendLabel } from "@/lib/metrics";
import { cn } from "@/lib/utils";

export function trendTone(label: TrendLabel): "rising" | "falling" | "steady" {
  if (label === "rising" || label === "new") return "rising";
  if (label === "falling") return "falling";
  return "steady";
}

export const TONE_TEXT = { rising: "text-rising", falling: "text-falling", steady: "text-steady" } as const;
export const TONE_STROKE = { rising: "var(--rising)", falling: "var(--falling)", steady: "var(--steady)" } as const;

export function TrendIcon({ label, className }: { label: TrendLabel; className?: string }) {
  const tone = trendTone(label);
  const Icon = tone === "rising" ? ArrowUpRight : tone === "falling" ? ArrowDownRight : Minus;
  return <Icon aria-hidden="true" className={cn("size-4", TONE_TEXT[tone], className)} />;
}

/** "▲ +4 (+33%) Rising". The delta is the confident number; the label sits small beside it. */
export function DeltaMark({ label, delta, pct }: { label: TrendLabel; delta: number | null; pct: number | null }) {
  const tone = trendTone(label);
  return (
    <span className="inline-flex flex-col leading-tight">
      <span className={cn("tabular inline-flex items-center gap-0.5 text-base font-semibold", TONE_TEXT[tone])}>
        {tone !== "steady" && <TrendIcon label={label} />}
        {formatDelta(delta, pct)}
      </span>
      <span className={cn("text-xs", label === "low signal" || label === "no history" ? "text-muted" : TONE_TEXT[tone])}>
        {TREND_TEXT[label]}
      </span>
    </span>
  );
}
