// Read-only queries used by the pages. Server-side only.
import type { BriefContent } from "./brief";
import type { SourceName, SourceStatus } from "./collectors/types";
import { ConfigError, isMissingTableError, query, queryOne, toIso } from "./db";
import { type Resolution, resolutionStatus } from "./metrics";

/** Wraps a page's data loading so setup problems become a clear message instead of a crash. */
export type Loaded<T> = { ok: true; data: T } | { ok: false; kind: "config" | "schema" | "other"; message: string };

export async function load<T>(fn: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (err instanceof ConfigError) return { ok: false, kind: "config", message: err.message };
    if (isMissingTableError(err)) {
      return { ok: false, kind: "schema", message: "The database tables do not exist yet. Run npm run db:migrate and npm run db:seed." };
    }
    console.error(err);
    return { ok: false, kind: "other", message: err instanceof Error ? err.message : String(err) };
  }
}

// ---------- Briefs ----------

export interface BriefRow {
  id: number;
  week_start: string;
  content: BriefContent;
  summary_markdown: string;
  email_status: string;
  emailed_at: string | null;
  created_at: string;
}

const BRIEF_COLUMNS = `id, week_start::text AS week_start, content, summary_markdown, email_status, emailed_at, created_at`;

export async function getLatestBrief(): Promise<BriefRow | null> {
  return queryOne<BriefRow>(`SELECT ${BRIEF_COLUMNS} FROM briefs ORDER BY week_start DESC LIMIT 1`);
}

export async function getBriefByWeek(weekStart: string): Promise<BriefRow | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return null;
  return queryOne<BriefRow>(`SELECT ${BRIEF_COLUMNS} FROM briefs WHERE week_start = $1::date`, [weekStart]);
}

export interface BriefListItem {
  week_start: string;
  week_end: string;
  headline: string;
  email_status: string;
  trigger: string;
  topics: number;
  mentions: number;
}

export async function listBriefs(): Promise<BriefListItem[]> {
  return query<BriefListItem>(
    `SELECT week_start::text AS week_start,
            content->>'weekEnd' AS week_end,
            content->>'headline' AS headline,
            email_status,
            content->>'trigger' AS trigger,
            jsonb_array_length(content->'topics') AS topics,
            COALESCE((SELECT sum((t->>'mentionCount')::int) FROM jsonb_array_elements(content->'topics') t), 0)::int AS mentions
       FROM briefs ORDER BY week_start DESC`,
  );
}

export async function countBriefWeeks(): Promise<number> {
  const row = await queryOne<{ n: number }>(`SELECT count(*)::int AS n FROM briefs`);
  return row?.n ?? 0;
}

// ---------- Runs ----------

export interface RunRow {
  id: number;
  trigger: "cron" | "manual" | "backfill";
  week_start: string;
  week_end: string;
  status: "running" | "success" | "partial" | "failed";
  stage: string;
  started_at: string;
  finished_at: string | null;
  posts_fetched: number;
  posts_relevant: number;
  gemini_calls: number;
  source_status: Partial<Record<SourceName, SourceStatus>>;
  details: RunDetails;
  error: string | null;
}

export interface RunDetails {
  stages?: { stage: string; ms: number }[];
  duplicates?: number;
  droppedByCap?: number;
  stored?: number;
  tagging?: {
    batches: number;
    failedBatches: number;
    skippedBatches: number;
    untaggedPosts: number;
    irrelevant: number;
    lowConfidence: number;
    invalidTopic: number;
    log: string[];
  };
  verification?: {
    itemsReceived: number;
    itemsKept: number;
    evidenceIdsRemoved: number;
    itemsDroppedNoEvidence: number;
    itemsDroppedDigits: number;
    itemsDroppedUnknownId: number;
    headlineReplaced: boolean;
  } | null;
  aiError?: string | null;
  email?: string;
}

function normaliseRun(row: RunRow): RunRow {
  return {
    ...row,
    week_start: toIso(row.week_start),
    week_end: toIso(row.week_end),
    started_at: toIso(row.started_at),
    finished_at: row.finished_at ? toIso(row.finished_at) : null,
  };
}

export async function listRuns(limit = 30): Promise<RunRow[]> {
  const rows = await query<RunRow>(`SELECT * FROM runs ORDER BY started_at DESC LIMIT $1`, [limit]);
  return rows.map(normaliseRun);
}

export async function getRun(id: number | "latest"): Promise<RunRow | null> {
  const row =
    id === "latest"
      ? await queryOne<RunRow>(`SELECT * FROM runs ORDER BY started_at DESC LIMIT 1`)
      : await queryOne<RunRow>(`SELECT * FROM runs WHERE id = $1`, [id]);
  return row ? normaliseRun(row) : null;
}

// ---------- Topic drill-down ----------

export interface TopicHeader {
  id: number;
  name: string;
  description: string;
  color: string;
  is_active: boolean;
}

export interface TopicSnapshot {
  week_start: string;
  mention_count: number;
  engagement: number;
  unresolved_share: number | null;
}

export interface TopicPost {
  id: number;
  source: SourceName;
  url: string;
  title: string;
  author_handle: string | null;
  created_at: string;
  score: number;
  comment_count: number;
  pain_point: string;
  week_start: string;
  resolution: Resolution;
}

export async function getTopicDetail(topicId: number, minAgeHours: number, timeZone: string) {
  const topic = await queryOne<TopicHeader>(`SELECT id, name, description, color, is_active FROM topics WHERE id = $1`, [topicId]);
  if (!topic) return null;
  const [snapshots, rows] = await Promise.all([
    query<TopicSnapshot>(
      `SELECT week_start::text AS week_start, mention_count, engagement, unresolved_share
         FROM weekly_snapshots WHERE topic_id = $1 ORDER BY week_start`,
      [topicId],
    ),
    query<{
      id: number;
      source: SourceName;
      url: string;
      title: string;
      author_handle: string | null;
      created_at_source: string;
      score: number;
      comment_count: number;
      answer_count: number | null;
      is_answered: boolean | null;
      has_accepted_answer: boolean | null;
      state: string | null;
      pain_point: string;
      unresolved_signal: boolean;
      week_end: string;
      week_start: string;
    }>(
      `SELECT p.id, p.source, p.url, p.title, p.author_handle, p.created_at_source, p.score, p.comment_count,
              p.answer_count, p.is_answered, p.has_accepted_answer, p.state,
              pt.pain_point, pt.unresolved_signal, r.week_end,
              (r.week_start AT TIME ZONE $2)::date::text AS week_start
         FROM post_tags pt
         JOIN posts p ON p.id = pt.post_id
         JOIN runs r ON r.id = pt.run_id
        WHERE pt.topic_id = $1
        ORDER BY p.created_at_source DESC
        LIMIT 500`,
      [topicId, timeZone],
    ),
  ]);

  const posts: TopicPost[] = rows.map((r) => ({
    id: r.id,
    source: r.source,
    url: r.url,
    title: r.title,
    author_handle: r.author_handle,
    created_at: toIso(r.created_at_source),
    score: r.score,
    comment_count: r.comment_count,
    pain_point: r.pain_point,
    week_start: r.week_start,
    // Resolution is judged as of the end of the week the post was collected in.
    resolution: resolutionStatus(
      {
        source: r.source,
        createdAt: new Date(toIso(r.created_at_source)),
        hasAcceptedAnswer: r.has_accepted_answer,
        isAnswered: r.is_answered,
        answerCount: r.answer_count,
        state: r.state,
        commentCount: r.comment_count,
        unresolvedSignal: r.unresolved_signal,
      },
      new Date(toIso(r.week_end)),
      minAgeHours,
    ),
  }));

  return { topic, snapshots, posts };
}

// ---------- Settings audit ----------

export interface ConfigChange {
  id: number;
  entity: string;
  entity_id: string;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  changed_at: string;
}

export async function recentConfigChanges(limit = 12): Promise<ConfigChange[]> {
  const rows = await query<ConfigChange>(`SELECT * FROM config_changes ORDER BY changed_at DESC LIMIT $1`, [limit]);
  return rows.map((r) => ({ ...r, changed_at: toIso(r.changed_at) }));
}
