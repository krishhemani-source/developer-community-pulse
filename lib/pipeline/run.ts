// The orchestrator. Runs every stage in order and records progress in the `runs` table
// after each one, so the UI can show live progress and the run log can explain what happened.
//
//   collect -> clean -> tag (Gemini) -> measure (code) -> write (Gemini) -> verify (code) -> send
import type { PostTag } from "../ai/tagPosts";
import { tagPosts } from "../ai/tagPosts";
import { writeBrief, type BriefInput } from "../ai/writeBrief";
import type { GeminiCounter } from "../ai/gemini";
import { type BriefContent, type EvidencePost, briefToMarkdown, fallbackHeadline, streakText } from "../brief";
import { collectAll } from "../collectors";
import { SOURCE_LABELS, SOURCES, type SourceName, type SourceStatus } from "../collectors/types";
import { loadConfig } from "../config";
import { query } from "../db";
import { appUrl, sendBriefEmail } from "../email/sendBrief";
import { type MeasuredPost, byEngagement, objectionCounts, resolutionStatus } from "../metrics";
import { type EvidenceRef, type VerifyReport, verifyBrief } from "../verify";
import type { WeekWindow } from "../weeks";
import { type StoredPost, cleanAndStore } from "./clean";
import { type Trigger, createRun } from "./lock";
import { type TopicMeasure, measureWeek, toMeasured } from "./measure";

export const STAGES = ["collecting", "cleaning", "tagging", "measuring", "writing", "verifying", "sending"] as const;
export type Stage = (typeof STAGES)[number] | "queued" | "done";

// Time budget inside Vercel's 300-second limit (measured from the start of the run):
/** No new tagging batch starts after this. */
const TAGGING_START_DEADLINE_MS = 165_000;
/** Every tagging request must be finished by this. */
const TAGGING_CALL_DEADLINE_MS = 220_000;
/** Brief writing must be finished by this; afterwards the brief falls back to code-only text. */
const WRITING_DEADLINE_MS = 280_000;

export interface RunPipelineOptions {
  trigger: Trigger;
  window: WeekWindow;
  runId?: number; // pass when the run row was already created (to return its id to the UI first)
  sendEmail: boolean;
}

export interface RunOutcome {
  runId: number;
  status: "success" | "partial" | "failed";
  error: string | null;
}

export async function runPipeline(opts: RunPipelineOptions): Promise<RunOutcome> {
  const createdId = opts.runId ?? (await createRun(opts.trigger, opts.window));
  if (createdId === null) throw new Error("Another run is already in progress.");
  const runId: number = createdId;

  const runStarted = Date.now();
  const counter: GeminiCounter = { calls: 0 };
  const stageTimings: { stage: string; ms: number }[] = [];
  const details: Record<string, unknown> = { stages: stageTimings };
  let sourceStatus: Partial<Record<SourceName, SourceStatus>> = {};
  let postsFetched = 0;
  let postsRelevant = 0;
  let partial = false;
  let currentStage: Stage = "queued";
  let stageStarted = Date.now();

  async function enter(stage: Stage) {
    if (currentStage !== "queued") stageTimings.push({ stage: currentStage, ms: Date.now() - stageStarted });
    currentStage = stage;
    stageStarted = Date.now();
    await query(`UPDATE runs SET stage = $2, gemini_calls = $3 WHERE id = $1`, [runId, stage, counter.calls]);
  }

  async function finish(status: RunOutcome["status"], error: string | null) {
    if (currentStage !== "queued" && currentStage !== "done") {
      stageTimings.push({ stage: currentStage, ms: Date.now() - stageStarted });
    }
    await query(
      `UPDATE runs SET status = $2, stage = $3, finished_at = now(), posts_fetched = $4, posts_relevant = $5,
              gemini_calls = $6, source_status = $7::jsonb, details = $8::jsonb, error = $9
        WHERE id = $1`,
      [
        runId,
        status,
        status === "failed" ? currentStage : "done",
        postsFetched,
        postsRelevant,
        counter.calls,
        JSON.stringify(sourceStatus),
        JSON.stringify(details),
        error,
      ],
    );
    return { runId, status, error };
  }

  try {
    const config = await loadConfig();
    const { topics, keywords, objections, settings } = config;
    if (topics.length === 0) throw new Error("No active topics. Add or reactivate a topic in Settings.");
    if (keywords.length === 0) throw new Error("No active keywords. Add keywords in Settings.");

    // ---- 1. Collect ----
    await enter("collecting");
    const collected = await collectAll({
      keywords: keywords.map((k) => k.phrase),
      devtoTags: settings.devto_tags,
      start: opts.window.start,
      end: opts.window.end,
    });
    sourceStatus = collected.sourceStatus;
    postsFetched = collected.posts.length;
    if (collected.anyFailed) partial = true;
    await query(`UPDATE runs SET source_status = $2::jsonb, posts_fetched = $3 WHERE id = $1`, [
      runId,
      JSON.stringify(sourceStatus),
      postsFetched,
    ]);
    if (SOURCES.every((s) => !collected.sourceStatus[s].ok)) {
      throw new Error("Every source failed. Check the per-source errors below; usually a network problem or rate limit.");
    }

    // ---- 2. Clean ----
    await enter("cleaning");
    const cleaned = await cleanAndStore(collected.posts);
    details.duplicates = cleaned.duplicates;
    details.droppedByCap = cleaned.droppedByCap;
    details.stored = cleaned.posts.length;

    // ---- 3. Tag (Gemini) ----
    await enter("tagging");
    const tagResult = await tagPosts(
      cleaned.posts.map((p) => ({
        postId: p.id,
        source: p.source,
        title: p.title,
        body: p.body,
        isAnswered: p.isAnswered,
        hasAcceptedAnswer: p.hasAcceptedAnswer,
      })),
      topics,
      objections,
      { counter, startDeadline: runStarted + TAGGING_START_DEADLINE_MS, callDeadline: runStarted + TAGGING_CALL_DEADLINE_MS },
    );
    details.tagging = { ...tagResult, tags: undefined };
    if (tagResult.failedBatches > 0 || tagResult.skippedBatches > 0) partial = true;
    if (cleaned.posts.length > 0 && tagResult.failedBatches === tagResult.batches) {
      throw new Error(`Gemini tagging failed for every batch. ${tagResult.log[0] ?? ""}`);
    }
    await insertTags(runId, tagResult.tags);
    postsRelevant = tagResult.tags.length;

    // ---- 4. Measure (code only) ----
    await enter("measuring");
    const storedById = new Map(cleaned.posts.map((p) => [p.id, p]));
    const measured: MeasuredPost[] = tagResult.tags.map((t) => toMeasured(storedById.get(t.postId)!, t));
    const measures = await measureWeek({ runId, window: opts.window, topics, settings, posts: measured });

    // ---- 5. Write (Gemini) ----
    await enter("writing");
    const evidenceMap = new Map<string, EvidenceRef & { postId: number }>();
    const briefInput = buildBriefInput(measures, objections, measured, storedById, sourceStatus, evidenceMap);
    let raw = null;
    let aiError: string | null = null;
    if (measured.length > 0) {
      try {
        raw = await writeBrief(briefInput, counter, runStarted + WRITING_DEADLINE_MS);
      } catch (err) {
        aiError = err instanceof Error ? err.message : String(err);
        partial = true;
      }
    }

    // ---- 6. Verify (code) ----
    await enter("verifying");
    const verified = raw
      ? verifyBrief(raw, evidenceMap, new Set(measures.filter((m) => m.stats.mentionCount > 0).map((m) => m.topic.id)), new Set(objections.map((o) => o.id)))
      : null;
    details.verification = verified?.report ?? null;
    details.aiError = aiError;

    const content = assembleBrief({
      runId,
      opts,
      settingsTimezone: settings.timezone,
      threshold: settings.low_signal_threshold,
      minAgeHours: settings.unresolved_min_age_hours,
      measures,
      measured,
      storedById,
      objections,
      verified,
      evidenceMap,
      aiError,
      sourceStatus: collected.sourceStatus,
      totals: {
        fetched: postsFetched,
        stored: cleaned.posts.length,
        relevant: postsRelevant,
        droppedByCap: cleaned.droppedByCap,
      },
      tagNotes: tagResult,
    });
    const markdown = briefToMarkdown(content, appUrl());

    // Replace any brief for this same week (idempotent reruns), then save.
    await query(`DELETE FROM briefs WHERE abs(week_start - $1::date) <= 3`, [opts.window.weekStart]);
    await query(
      `INSERT INTO briefs (week_start, run_id, content, summary_markdown, email_status)
       VALUES ($1::date, $2, $3::jsonb, $4, $5)`,
      [opts.window.weekStart, runId, JSON.stringify(content), markdown, opts.sendEmail ? "pending" : "not_sent"],
    );

    // ---- 7. Send ----
    if (opts.sendEmail) {
      await enter("sending");
      const email = await sendBriefEmail(content, settings.recipient_email);
      details.email = email.status;
      if (email.status.startsWith("failed")) partial = true;
      await query(
        `UPDATE briefs SET email_status = $2, emailed_at = CASE WHEN $3 THEN now() ELSE NULL END WHERE week_start = $1::date`,
        [opts.window.weekStart, email.status, email.sent],
      );
    }

    return await finish(partial ? "partial" : "success", null);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[run ${runId}] failed at ${currentStage}:`, message);
    try {
      return await finish("failed", `Failed while ${currentStage}: ${message}`);
    } catch {
      return { runId, status: "failed", error: message };
    }
  }
}

async function insertTags(runId: number, tags: PostTag[]): Promise<void> {
  for (let i = 0; i < tags.length; i += 200) {
    const chunk = tags.slice(i, i + 200);
    const params: unknown[] = [];
    const rows = chunk.map((t, r) => {
      params.push(t.postId, runId, t.topicId, t.painPoint, t.unresolvedSignal, t.objectionId, t.confidence);
      const b = r * 7;
      return `($${b + 1}, $${b + 2}, TRUE, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7})`;
    });
    await query(
      `INSERT INTO post_tags (post_id, run_id, relevant, topic_id, pain_point, unresolved_signal, objection_id, confidence)
       VALUES ${rows.join(", ")}
       ON CONFLICT (post_id, run_id) DO NOTHING`,
      params,
    );
  }
}

/** Builds Gemini's input: computed metrics plus the top 5 posts per topic under temporary ids. */
function buildBriefInput(
  measures: TopicMeasure[],
  objections: { id: number; label: string }[],
  measured: MeasuredPost[],
  storedById: Map<number, StoredPost>,
  sourceStatus: Partial<Record<SourceName, SourceStatus>>,
  evidenceMap: Map<string, EvidenceRef & { postId: number }>,
): BriefInput {
  const counts = objectionCounts(measured);
  let n = 0;
  return {
    topics: measures
      .filter((m) => m.stats.mentionCount > 0)
      .map((m) => ({
        topic_id: m.topic.id,
        name: m.topic.name,
        mention_count: m.stats.mentionCount,
        change_vs_last_week: m.change.delta,
        trend: m.change.label,
        streak: streakText(m.streak),
        unresolved_share: m.stats.unresolvedShare === null ? null : Math.round(m.stats.unresolvedShare * 100) / 100,
        underserved_score: m.underservedScore,
        top_posts: m.posts.slice(0, 5).map((p) => {
          const id = `e${++n}`;
          evidenceMap.set(id, { topicId: m.topic.id, objectionId: p.objectionId, postId: p.postId });
          return { id, title: storedById.get(p.postId)?.title ?? "", pain_point: p.painPoint, source: p.source, objection_id: p.objectionId };
        }),
      })),
    objections: objections.map((o) => ({ objection_id: o.id, label: o.label, matching_posts: counts.get(o.id) ?? 0 })),
    missing_sources: SOURCES.filter((s) => sourceStatus[s] && !sourceStatus[s]!.ok).map((s) => SOURCE_LABELS[s]),
  };
}

interface AssembleInput {
  runId: number;
  opts: RunPipelineOptions;
  settingsTimezone: string;
  threshold: number;
  minAgeHours: number;
  measures: TopicMeasure[];
  measured: MeasuredPost[];
  storedById: Map<number, StoredPost>;
  objections: { id: number; label: string }[];
  verified: ReturnType<typeof verifyBrief> | null;
  evidenceMap: Map<string, EvidenceRef & { postId: number }>;
  aiError: string | null;
  sourceStatus: Record<SourceName, SourceStatus>;
  totals: BriefContent["totals"];
  tagNotes: { failedBatches: number; skippedBatches: number; untaggedPosts: number };
}

/** Combines code-computed numbers with verified AI text into the saved brief. */
function assembleBrief(a: AssembleInput): BriefContent {
  const evidence = (postId: number, painPoint: string): EvidencePost | null => {
    const p = a.storedById.get(postId);
    if (!p) return null;
    const m = a.measured.find((x) => x.postId === postId);
    return {
      postId,
      title: p.title,
      url: p.url,
      source: p.source,
      resolution: m ? resolutionStatus(m, a.opts.window.end, a.minAgeHours) : "no_signal",
      createdAt: p.createdAt.toISOString(),
      score: p.score,
      commentCount: p.commentCount,
      painPoint,
    };
  };
  const fromTempIds = (ids: string[]) =>
    ids
      .map((id) => a.evidenceMap.get(id))
      .filter((ref): ref is EvidenceRef & { postId: number } => ref !== undefined)
      .map((ref) => evidence(ref.postId, a.measured.find((m) => m.postId === ref.postId)?.painPoint ?? ""))
      .filter((e): e is EvidencePost => e !== null);

  const insights = new Map((a.verified?.topPainPoints ?? []).map((p) => [p.topicId, p]));

  const topics = a.measures.map((m) => {
    const insight = insights.get(m.topic.id);
    const cited = insight ? fromTempIds(insight.evidenceIds) : [];
    const citedIds = new Set(cited.map((e) => e.postId));
    const others = m.posts
      .filter((p) => !citedIds.has(p.postId))
      .map((p) => evidence(p.postId, p.painPoint))
      .filter((e): e is EvidencePost => e !== null);
    return {
      id: m.topic.id,
      name: m.topic.name,
      color: m.topic.color,
      rank: m.rank,
      mentionCount: m.stats.mentionCount,
      engagement: m.stats.engagement,
      previousCount: m.previousCount,
      delta: m.change.delta,
      pct: m.change.pct,
      trend: m.change.label,
      streak: m.streak,
      series: m.series,
      resolution: m.stats.resolution,
      judgedCount: m.stats.judgedCount,
      unresolvedShare: m.stats.unresolvedShare,
      underservedScore: m.underservedScore,
      insight: insight?.insight ?? null,
      evidence: [...cited, ...others].slice(0, 5),
      painPoints: [...new Set(m.posts.map((p) => p.painPoint).filter(Boolean))].slice(0, 8),
    };
  });

  const counts = objectionCounts(a.measured);
  const objectionText = new Map((a.verified?.objectionSignals ?? []).map((o) => [o.objectionId, o]));
  const objections = a.objections.map((o) => {
    const posts = a.measured
      .filter((m) => m.objectionId === o.id)
      .sort(byEngagement)
      .slice(0, 5)
      .map((m) => evidence(m.postId, m.painPoint))
      .filter((e): e is EvidencePost => e !== null);
    return {
      objectionId: o.id,
      label: o.label,
      count: counts.get(o.id) ?? 0,
      whatDevelopersSay: objectionText.get(o.id)?.whatDevelopersSay ?? null,
      posts,
    };
  });
  objections.sort((x, y) => y.count - x.count);

  const notes: string[] = [];
  for (const s of SOURCES) {
    if (!a.sourceStatus[s].ok) notes.push(`${SOURCE_LABELS[s]} was unavailable this week, so its discussions are missing from these counts.`);
  }
  if (a.totals.droppedByCap > 0) notes.push(`${a.totals.droppedByCap} lower-engagement ${a.totals.droppedByCap === 1 ? "post was" : "posts were"} left out to keep the run within its 400-post cap.`);
  if (a.tagNotes.untaggedPosts > 0) notes.push(`${a.tagNotes.untaggedPosts} ${a.tagNotes.untaggedPosts === 1 ? "post" : "posts"} could not be tagged by Gemini and ${a.tagNotes.untaggedPosts === 1 ? "is" : "are"} not counted.`);
  if (a.aiError) notes.push("Gemini could not write the summary this week; numbers and evidence are shown without commentary.");
  const report: VerifyReport | null = a.verified?.report ?? null;

  const headline = a.verified?.headline ?? fallbackHeadline(topics);
  return {
    version: 1,
    runId: a.runId,
    trigger: a.opts.trigger,
    weekStart: a.opts.window.weekStart,
    weekEnd: a.opts.window.weekEnd,
    windowStart: a.opts.window.start.toISOString(),
    windowEnd: a.opts.window.end.toISOString(),
    generatedAt: new Date().toISOString(),
    timezone: a.settingsTimezone,
    lowSignalThreshold: a.threshold,
    headline,
    headlineSource: a.verified?.headline ? "ai" : "code",
    aiError: a.aiError,
    topics,
    underserved: (a.verified?.underserved ?? []).map((u) => ({
      topicId: u.topicId,
      whyUnresolved: u.whyUnresolved,
      evidence: fromTempIds(u.evidenceIds),
    })),
    objections,
    talkingPoints: a.verified?.talkingPoints ?? [],
    sources: a.sourceStatus,
    notes,
    verification: report,
    totals: a.totals,
  };
}
