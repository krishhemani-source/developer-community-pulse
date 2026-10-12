// Stage 3: Gemini reads each post and tags it. It interprets; it does not count.
// Only public post text is sent. Author handles are never part of the payload.
import type { SourceName } from "../collectors/types";
import { mapLimit } from "../collectors/types";
import type { Objection, Topic } from "../config";
import { type GeminiCounter, generateJson } from "./gemini";
import { TagResponseSchema, tagResponseSchema } from "./schemas";

export const BATCH_SIZE = 25;
export const PARALLEL_BATCHES = 2; // spec allows up to 3; 2 avoids free-tier rate-limit bursts
export const MIN_CONFIDENCE = 0.5;

/** The fields we are allowed to send. Deliberately no author, no URL, no ids from the source. */
export interface TagInputPost {
  postId: number; // our database id, kept locally; Gemini only sees a temporary id
  source: SourceName;
  title: string;
  body: string;
  isAnswered: boolean | null;
  hasAcceptedAnswer: boolean | null;
}

export interface PostTag {
  postId: number;
  topicId: number;
  painPoint: string;
  unresolvedSignal: boolean;
  objectionId: number | null;
  confidence: number;
}

export interface TagResult {
  tags: PostTag[];
  batches: number;
  failedBatches: number;
  skippedBatches: number; // not started because the run's time budget ran out
  untaggedPosts: number;
  irrelevant: number;
  lowConfidence: number;
  invalidTopic: number;
  log: string[];
}

const SYSTEM = `You classify public developer community posts for a product manager at a company that sells a code review automation tool.
Return one result for every post id you are given.

Rules:
- relevant is true ONLY if the post is about software development workflow in this problem space: code review, pull requests, CI/CD, automated checks, static analysis, developer tooling for reviewing or shipping code. A "review" of a movie or product, or an oil or sales "pipeline", is NOT relevant.
- topic_id must be one of the provided topic ids, or null when relevant is false or nothing fits.
- pain_point: the developer's problem in at most 12 plain words. No hype, no emoji.
- unresolved_signal is true when the author or replies describe a problem with no working solution, a workaround they dislike, or say no tool does this well.
- objection_id: the id of a sales objection the post clearly echoes, otherwise null.
- confidence: 0 to 1, how sure you are about relevant and topic_id.`;

function buildPrompt(batch: { tempId: string; post: TagInputPost }[], topics: Topic[], objections: Objection[]): string {
  const payload = {
    topics: topics.map((t) => ({ id: t.id, name: t.name, description: t.description })),
    sales_objections: objections.map((o) => ({ id: o.id, label: o.label })),
    posts: batch.map(({ tempId, post }) => ({
      id: tempId,
      source: post.source,
      title: post.title,
      body_excerpt: post.body,
      answered: post.isAnswered,
      accepted_answer: post.hasAcceptedAnswer,
    })),
  };
  return `Classify each post.\n\n${JSON.stringify(payload)}`;
}

/** First 12 words, plain. */
function clampWords(text: string, max = 12): string {
  return text.replace(/\s+/g, " ").trim().split(" ").slice(0, max).join(" ");
}

export async function tagPosts(
  posts: TagInputPost[],
  topics: Topic[],
  objections: Objection[],
  opts: { counter: GeminiCounter; deadline: number },
): Promise<TagResult> {
  const topicIds = new Set(topics.map((t) => t.id));
  const objectionIds = new Set(objections.map((o) => o.id));
  const result: TagResult = {
    tags: [],
    batches: 0,
    failedBatches: 0,
    skippedBatches: 0,
    untaggedPosts: 0,
    irrelevant: 0,
    lowConfidence: 0,
    invalidTopic: 0,
    log: [],
  };

  // Temporary ids ("p0", "p1" ...) are all Gemini ever sees.
  const withIds = posts.map((post, i) => ({ tempId: `p${i}`, post }));
  const batches: (typeof withIds)[] = [];
  for (let i = 0; i < withIds.length; i += BATCH_SIZE) batches.push(withIds.slice(i, i + BATCH_SIZE));
  result.batches = batches.length;

  await mapLimit(batches, PARALLEL_BATCHES, async (batch, index) => {
    if (Date.now() > opts.deadline) {
      result.skippedBatches++;
      result.untaggedPosts += batch.length;
      result.log.push(`Batch ${index + 1}: skipped, run time budget reached.`);
      return;
    }
    let items;
    try {
      items = (
        await generateJson({
          system: SYSTEM,
          prompt: buildPrompt(batch, topics, objections),
          responseSchema: tagResponseSchema,
          validator: TagResponseSchema,
          counter: opts.counter,
        })
      ).items;
    } catch (err) {
      // Broken JSON twice: leave these posts untagged, log it, and carry on.
      result.failedBatches++;
      result.untaggedPosts += batch.length;
      result.log.push(`Batch ${index + 1}: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    const byTempId = new Map(batch.map((b) => [b.tempId, b.post]));
    const seen = new Set<string>();
    for (const item of items) {
      const post = byTempId.get(item.id);
      if (!post || seen.has(item.id)) continue; // ignore ids we never sent, and duplicates
      seen.add(item.id);
      if (!item.relevant) {
        result.irrelevant++;
        continue;
      }
      if (item.confidence < MIN_CONFIDENCE) {
        result.lowConfidence++;
        continue;
      }
      if (item.topic_id === null || !topicIds.has(item.topic_id)) {
        result.invalidTopic++;
        continue;
      }
      result.tags.push({
        postId: post.postId,
        topicId: item.topic_id,
        painPoint: clampWords(item.pain_point),
        unresolvedSignal: item.unresolved_signal,
        objectionId: item.objection_id !== null && objectionIds.has(item.objection_id) ? item.objection_id : null,
        confidence: item.confidence,
      });
    }
    const missing = batch.length - seen.size;
    if (missing > 0) {
      result.untaggedPosts += missing;
      result.log.push(`Batch ${index + 1}: Gemini skipped ${missing} posts.`);
    }
  });

  return result;
}
