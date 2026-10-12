// The shape of a saved brief (briefs.content) and helpers that render it as text.
// A brief is self-contained: history pages render old briefs exactly as they were sent.
import { SOURCE_LABELS, type SourceName, type SourceStatus } from "./collectors/types";
import type { Resolution, ResolutionCounts, Streak, TrendLabel } from "./metrics";
import type { VerifyReport } from "./verify";
import { formatWeekRange } from "./weeks";

export interface EvidencePost {
  postId: number;
  title: string;
  url: string;
  source: SourceName;
  resolution: Resolution;
  createdAt: string;
  score: number;
  commentCount: number;
  painPoint: string;
}

export interface TopicBrief {
  id: number;
  name: string;
  color: string;
  rank: number;
  mentionCount: number;
  engagement: number;
  previousCount: number | null;
  delta: number | null;
  pct: number | null;
  trend: TrendLabel;
  streak: Streak;
  series: { weekStart: string; count: number }[]; // oldest to newest, includes this week
  resolution: ResolutionCounts;
  judgedCount: number;
  unresolvedShare: number | null;
  underservedScore: number;
  insight: string | null;
  evidence: EvidencePost[];
  painPoints: string[];
}

export interface BriefContent {
  version: 1;
  runId: number;
  trigger: "cron" | "manual" | "backfill";
  weekStart: string;
  weekEnd: string;
  windowStart: string;
  windowEnd: string;
  generatedAt: string;
  timezone: string;
  lowSignalThreshold: number;
  headline: string;
  headlineSource: "ai" | "code";
  aiError: string | null;
  topics: TopicBrief[];
  underserved: { topicId: number; whyUnresolved: string; evidence: EvidencePost[] }[];
  objections: { objectionId: number; label: string; count: number; whatDevelopersSay: string | null; posts: EvidencePost[] }[];
  talkingPoints: string[];
  sources: Record<SourceName, SourceStatus>;
  notes: string[];
  verification: VerifyReport | null;
  totals: { fetched: number; stored: number; relevant: number; droppedByCap: number };
}

// ---------- Formatting helpers shared by the UI, email and markdown ----------

export const TREND_TEXT: Record<TrendLabel, string> = {
  new: "New",
  rising: "Rising",
  falling: "Falling",
  steady: "Steady",
  "low signal": "Low signal",
  "no history": "No last week data",
};

/** "+4 (+33%)", "−2", "0", or "–" when there is nothing to compare. */
export function formatDelta(delta: number | null, pct: number | null): string {
  if (delta === null) return "–";
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
  const base = `${sign}${Math.abs(delta)}`;
  if (pct === null) return base;
  const pctSign = pct > 0 ? "+" : pct < 0 ? "−" : "";
  return `${base} (${pctSign}${Math.abs(pct)}%)`;
}

export function formatShare(share: number | null): string {
  return share === null ? "–" : `${Math.round(share * 100)}%`;
}

export function streakText(streak: Streak): string | null {
  if (!streak.direction || streak.weeks < 2) return null;
  return `${streak.direction === "rising" ? "Rising" : "Falling"} ${streak.weeks} weeks in a row`;
}

export function trendArrow(label: TrendLabel): string {
  if (label === "rising" || label === "new") return "▲";
  if (label === "falling") return "▼";
  return "–";
}

/** A plain headline written by code, used if Gemini's headline is missing or fails verification. */
export function fallbackHeadline(topics: TopicBrief[]): string {
  const active = topics.filter((t) => t.mentionCount > 0);
  if (active.length === 0) return "No relevant developer discussion was found this week in the tracked communities.";
  const top = active[0];
  const rising = active.filter((t) => t.trend === "rising" || t.trend === "new");
  const risingText = rising.length > 0 ? ` Rising: ${rising.map((t) => t.name).join(", ")}.` : "";
  return `${top.name} was the most discussed pain point this week with ${top.mentionCount} mentions.${risingText}`;
}

/** Clean markdown for the "Copy for Google Doc" button. Numbers come from code. */
export function briefToMarkdown(brief: BriefContent, dashboardUrl: string | null): string {
  const lines: string[] = [];
  lines.push(`# Developer Community Pulse: ${formatWeekRange(brief.weekStart, brief.weekEnd)}`, "");
  lines.push(brief.headline, "");

  lines.push("## Pain points this week", "");
  for (const t of brief.topics) {
    if (t.mentionCount === 0) {
      lines.push(`${t.rank}. **${t.name}**: no discussion this week`);
      continue;
    }
    const streak = streakText(t.streak);
    lines.push(
      `${t.rank}. **${t.name}**: ${t.mentionCount} mentions, ${formatDelta(t.delta, t.pct)} vs last week, ${TREND_TEXT[t.trend].toLowerCase()}${streak ? `, ${streak.toLowerCase()}` : ""}. Unresolved share ${formatShare(t.unresolvedShare)}.`,
    );
    if (t.insight) lines.push(`   ${t.insight}`);
    for (const e of t.evidence.slice(0, 3)) lines.push(`   - [${e.title}](${e.url}) (${SOURCE_LABELS[e.source]})`);
  }
  lines.push("");

  if (brief.underserved.length > 0) {
    lines.push("## Underserved problems", "");
    for (const u of brief.underserved) {
      const topic = brief.topics.find((t) => t.id === u.topicId);
      lines.push(`- **${topic?.name ?? "Topic"}** (${formatShare(topic?.unresolvedShare ?? null)} unresolved): ${u.whyUnresolved}`);
      for (const e of u.evidence.slice(0, 2)) lines.push(`  - [${e.title}](${e.url})`);
    }
    lines.push("");
  }

  const withSignals = brief.objections.filter((o) => o.count > 0);
  if (withSignals.length > 0) {
    lines.push("## Sales objection signals", "");
    for (const o of withSignals) {
      lines.push(`- **${o.label}**: ${o.count} posts${o.whatDevelopersSay ? `. ${o.whatDevelopersSay}` : ""}`);
      for (const p of o.posts.slice(0, 2)) lines.push(`  - [${p.title}](${p.url})`);
    }
    lines.push("");
  }

  if (brief.talkingPoints.length > 0) {
    lines.push("## Monday talking points", "");
    brief.talkingPoints.forEach((p, i) => lines.push(`${i + 1}. ${p}`));
    lines.push("");
  }

  if (brief.notes.length > 0) {
    lines.push("## Notes", "");
    for (const n of brief.notes) lines.push(`- ${n}`);
    lines.push("");
  }

  if (dashboardUrl) lines.push(`Dashboard: ${dashboardUrl}`, "");
  lines.push("_This brief measures and explains. Sprint decisions stay with you._");
  return lines.join("\n");
}
