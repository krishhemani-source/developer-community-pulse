// All numbers in the brief come from this file. Gemini never counts.
// Every function here is pure (no database, no network), so each rule is unit-tested
// in tests/metrics.test.ts.
import type { SourceName } from "./collectors/types";

// ---------- Resolution status per post ----------

export type Resolution =
  | "resolved" // SO accepted answer, or GitHub issue closed
  | "partly_resolved" // SO: answered, but no accepted answer
  | "unresolved" // SO answers but not answered; GitHub open with 3+ comments; HN/Dev.to unresolved signal
  | "unanswered" // SO: zero answers
  | "no_signal" // HN/Dev.to: discussion without an unresolved signal
  | "open_quiet" // GitHub: open with fewer than 3 comments (too little to judge)
  | "too_new"; // younger than unresolved_min_age_hours: excluded from resolution maths

export const RESOLUTIONS: Resolution[] = [
  "resolved",
  "partly_resolved",
  "unresolved",
  "unanswered",
  "no_signal",
  "open_quiet",
  "too_new",
];

export const RESOLUTION_LABELS: Record<Resolution, string> = {
  resolved: "Resolved",
  partly_resolved: "Partly resolved",
  unresolved: "Unresolved",
  unanswered: "Unanswered",
  no_signal: "No unresolved signal",
  open_quiet: "Open, little discussion",
  too_new: "Too new to judge",
};

/** Statuses that are left out of the unresolved share. */
const NOT_JUDGED: Resolution[] = ["too_new", "open_quiet"];

export interface ResolutionInput {
  source: SourceName;
  createdAt: Date;
  hasAcceptedAnswer: boolean | null;
  isAnswered: boolean | null;
  answerCount: number | null;
  state: string | null;
  commentCount: number;
  unresolvedSignal: boolean;
}

export function resolutionStatus(post: ResolutionInput, weekEnd: Date, minAgeHours: number): Resolution {
  const ageHours = (weekEnd.getTime() - post.createdAt.getTime()) / 3_600_000;
  if (ageHours < minAgeHours) return "too_new";

  switch (post.source) {
    case "stackoverflow":
      if (post.hasAcceptedAnswer) return "resolved";
      if (post.isAnswered) return "partly_resolved";
      if ((post.answerCount ?? 0) > 0) return "unresolved";
      return "unanswered";
    case "github":
      if (post.state === "closed") return "resolved";
      if (post.commentCount >= 3) return "unresolved";
      return "open_quiet";
    case "hackernews":
    case "devto":
      return post.unresolvedSignal ? "unresolved" : "no_signal";
  }
}

// ---------- Per topic, per week ----------

export interface MeasuredPost extends ResolutionInput {
  postId: number;
  topicId: number;
  objectionId: number | null;
  painPoint: string;
  score: number;
}

export type ResolutionCounts = Record<Resolution, number>;

export interface TopicWeekStats {
  mentionCount: number;
  engagement: number;
  resolution: ResolutionCounts;
  judgedCount: number;
  unresolvedCount: number; // unresolved + unanswered
  resolvedCount: number; // resolved + partly resolved
  unresolvedShare: number | null; // null when nothing could be judged
}

export function engagementOf(post: { score: number; commentCount: number }): number {
  return post.score + post.commentCount;
}

export function emptyResolutionCounts(): ResolutionCounts {
  return Object.fromEntries(RESOLUTIONS.map((r) => [r, 0])) as ResolutionCounts;
}

export function topicWeekStats(posts: MeasuredPost[], weekEnd: Date, minAgeHours: number): TopicWeekStats {
  const resolution = emptyResolutionCounts();
  let engagement = 0;
  for (const post of posts) {
    resolution[resolutionStatus(post, weekEnd, minAgeHours)]++;
    engagement += engagementOf(post);
  }
  const judgedCount = RESOLUTIONS.filter((r) => !NOT_JUDGED.includes(r)).reduce((sum, r) => sum + resolution[r], 0);
  const unresolvedCount = resolution.unresolved + resolution.unanswered;
  const resolvedCount = resolution.resolved + resolution.partly_resolved;
  return {
    mentionCount: posts.length,
    engagement,
    resolution,
    judgedCount,
    unresolvedCount,
    resolvedCount,
    unresolvedShare: judgedCount > 0 ? unresolvedCount / judgedCount : null,
  };
}

// ---------- Week over week ----------

export type TrendLabel = "new" | "rising" | "falling" | "steady" | "low signal" | "no history";

export interface WeekChange {
  delta: number | null; // this week minus last week
  pct: number | null; // shown only when last week >= low-signal threshold
  label: TrendLabel;
}

/**
 * Compares this week's count with last week's.
 * `previous` is null when there is no stored previous week at all.
 * Rules (in order):
 *   low signal: both weeks below the threshold (small numbers exaggerate change)
 *   new:        zero last week, more than zero now
 *   rising:     up at least 25% AND at least 3 more mentions
 *   falling:    down at least 25% AND at least 3 fewer mentions
 *   steady:     everything else
 */
export function weekChange(current: number, previous: number | null, threshold: number): WeekChange {
  if (previous === null) return { delta: null, pct: null, label: "no history" };
  const delta = current - previous;
  const pct = previous >= threshold ? Math.round((delta / previous) * 100) : null;

  let label: TrendLabel;
  if (current < threshold && previous < threshold) label = "low signal";
  else if (previous === 0 && current > 0) label = "new";
  else if (delta >= 3 && delta / previous >= 0.25) label = "rising";
  else if (delta <= -3 && -delta / previous >= 0.25) label = "falling";
  else label = "steady";

  return { delta, pct, label };
}

export interface Streak {
  direction: "rising" | "falling" | null;
  weeks: number; // consecutive weeks moving in that direction, ending this week
}

/**
 * Consecutive weeks rising (or falling), counted back from the latest week.
 * `counts` is ordered oldest to newest and includes this week.
 * "new" counts as a rising week.
 */
export function streak(counts: number[], threshold: number): Streak {
  let direction: "rising" | "falling" | null = null;
  let weeks = 0;
  for (let i = counts.length - 1; i >= 1; i--) {
    const { label } = weekChange(counts[i], counts[i - 1], threshold);
    const dir = label === "rising" || label === "new" ? "rising" : label === "falling" ? "falling" : null;
    if (dir === null) break;
    if (direction === null) direction = dir;
    if (dir !== direction) break;
    weeks++;
  }
  return { direction, weeks };
}

// ---------- Underserved ----------

/**
 * Underserved score = (mentions / the busiest topic's mentions) x unresolved share.
 * High when a topic is both frequently discussed and mostly unresolved.
 */
export function underservedScores(items: { mentionCount: number; unresolvedShare: number | null }[]): number[] {
  const max = Math.max(0, ...items.map((i) => i.mentionCount));
  return items.map((i) => {
    if (max === 0 || i.unresolvedShare === null) return 0;
    return Math.round((i.mentionCount / max) * i.unresolvedShare * 1000) / 1000;
  });
}

// ---------- Objection signals ----------

export function objectionCounts(posts: { objectionId: number | null }[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const p of posts) {
    if (p.objectionId !== null) counts.set(p.objectionId, (counts.get(p.objectionId) ?? 0) + 1);
  }
  return counts;
}

/** Most engaged first; ties broken by newest. */
export function byEngagement<T extends { score: number; commentCount: number; createdAt: Date }>(a: T, b: T): number {
  return engagementOf(b) - engagementOf(a) || b.createdAt.getTime() - a.createdAt.getTime();
}
