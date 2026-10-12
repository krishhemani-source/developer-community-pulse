// Stage 4: measure. Turns tagged posts into per-topic numbers using lib/metrics.ts,
// compares against stored history, and writes weekly_snapshots.
import type { PostTag } from "../ai/tagPosts";
import type { Settings, Topic } from "../config";
import { query } from "../db";
import {
  type MeasuredPost,
  type Streak,
  type TopicWeekStats,
  type WeekChange,
  byEngagement,
  streak,
  topicWeekStats,
  underservedScores,
  weekChange,
} from "../metrics";
import type { WeekWindow } from "../weeks";
import type { StoredPost } from "./clean";

export interface TopicMeasure {
  topic: Topic;
  stats: TopicWeekStats;
  previousCount: number | null;
  change: WeekChange;
  streak: Streak;
  series: { weekStart: string; count: number }[];
  underservedScore: number;
  posts: MeasuredPost[]; // most engaged first
  rank: number;
}

export function toMeasured(post: StoredPost, tag: PostTag): MeasuredPost {
  return {
    postId: post.id,
    topicId: tag.topicId,
    objectionId: tag.objectionId,
    painPoint: tag.painPoint,
    unresolvedSignal: tag.unresolvedSignal,
    source: post.source,
    createdAt: post.createdAt,
    hasAcceptedAnswer: post.hasAcceptedAnswer,
    isAnswered: post.isAnswered,
    answerCount: post.answerCount,
    state: post.state,
    commentCount: post.commentCount,
    score: post.score,
  };
}

/**
 * Idempotent weeks: removes any earlier data for this week (any stored week starting
 * within 3 days), so a rerun replaces the week instead of doubling it.
 * Runs themselves are kept as the audit log.
 */
export async function replaceWeekData(runId: number, weekStart: string, timeZone: string): Promise<void> {
  await query(
    `DELETE FROM post_tags
      WHERE run_id IN (SELECT id FROM runs
                        WHERE id <> $1 AND abs((week_start AT TIME ZONE $3)::date - $2::date) <= 3)`,
    [runId, weekStart, timeZone],
  );
  await query(`DELETE FROM weekly_snapshots WHERE abs(week_start - $1::date) <= 3`, [weekStart]);
}

interface History {
  weeks: string[]; // stored week starts before this week, oldest first
  counts: Map<number, Map<string, number>>; // topic id -> week start -> mention count
}

async function loadHistory(weekStart: string): Promise<History> {
  const rows = await query<{ week_start: string; topic_id: number; mention_count: number }>(
    `SELECT week_start::text AS week_start, topic_id, mention_count
       FROM weekly_snapshots
      WHERE week_start < ($1::date - 3)
      ORDER BY week_start`,
    [weekStart],
  );
  const weeks: string[] = [];
  const counts = new Map<number, Map<string, number>>();
  for (const row of rows) {
    if (weeks[weeks.length - 1] !== row.week_start) weeks.push(row.week_start);
    if (!counts.has(row.topic_id)) counts.set(row.topic_id, new Map());
    counts.get(row.topic_id)!.set(row.week_start, row.mention_count);
  }
  return { weeks, counts };
}

export async function measureWeek(input: {
  runId: number;
  window: WeekWindow;
  topics: Topic[];
  settings: Settings;
  posts: MeasuredPost[];
}): Promise<TopicMeasure[]> {
  const { window, topics, settings, posts } = input;
  const threshold = settings.low_signal_threshold;

  await replaceWeekData(input.runId, window.weekStart, settings.timezone);
  const history = await loadHistory(window.weekStart);
  const lastWeek = history.weeks[history.weeks.length - 1] ?? null;

  const measures = topics.map((topic) => {
    const topicPosts = posts.filter((p) => p.topicId === topic.id).sort(byEngagement);
    const stats = topicWeekStats(topicPosts, window.end, settings.unresolved_min_age_hours);
    const past = history.counts.get(topic.id) ?? new Map<string, number>();

    // null when the topic has no snapshot for last week (no history yet, or a brand-new topic)
    const previousCount = lastWeek !== null && past.has(lastWeek) ? past.get(lastWeek)! : null;
    const pastCounts = history.weeks.filter((w) => past.has(w)).map((w) => past.get(w)!);

    return {
      topic,
      stats,
      previousCount,
      change: weekChange(stats.mentionCount, previousCount, threshold),
      streak: streak([...pastCounts, stats.mentionCount], threshold),
      series: [
        ...history.weeks.slice(-3).map((w) => ({ weekStart: w, count: past.get(w) ?? 0 })),
        { weekStart: window.weekStart, count: stats.mentionCount },
      ],
      underservedScore: 0,
      posts: topicPosts,
      rank: 0,
    };
  });

  const scores = underservedScores(measures.map((m) => m.stats));
  measures.forEach((m, i) => (m.underservedScore = scores[i]));

  // Rank: most mentions first, then most engagement, then Sumit's own topic order.
  measures.sort(
    (a, b) =>
      b.stats.mentionCount - a.stats.mentionCount ||
      b.stats.engagement - a.stats.engagement ||
      a.topic.sort_order - b.topic.sort_order,
  );
  measures.forEach((m, i) => (m.rank = i + 1));

  for (const m of measures) {
    const topPainPoints = m.posts.slice(0, 5).map((p) => ({ postId: p.postId, painPoint: p.painPoint }));
    await query(
      `INSERT INTO weekly_snapshots
         (week_start, topic_id, mention_count, engagement, unresolved_count, resolved_count, unresolved_share, top_pain_points)
       VALUES ($1::date, $2, $3, $4, $5, $6, $7, $8::jsonb)
       ON CONFLICT (week_start, topic_id) DO UPDATE SET
         mention_count = EXCLUDED.mention_count, engagement = EXCLUDED.engagement,
         unresolved_count = EXCLUDED.unresolved_count, resolved_count = EXCLUDED.resolved_count,
         unresolved_share = EXCLUDED.unresolved_share, top_pain_points = EXCLUDED.top_pain_points`,
      [
        window.weekStart,
        m.topic.id,
        m.stats.mentionCount,
        m.stats.engagement,
        m.stats.unresolvedCount,
        m.stats.resolvedCount,
        m.stats.unresolvedShare,
        JSON.stringify(topPainPoints),
      ],
    );
  }

  return measures;
}
