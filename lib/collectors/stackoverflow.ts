// Stack Overflow via the Stack Exchange 2.3 API (/search/advanced).
// Requests run one at a time so we can obey the API's `backoff` instruction.
// Without STACKEXCHANGE_KEY the quota is 300 requests/day; with it, 10,000.
import { z } from "zod";
import { decodeEntities, stripHtml } from "../text";
import { type CollectorInput, type CollectorResult, type Post, HttpError, errorMessage, fetchJson, sleep } from "./types";

const ItemSchema = z.object({
  question_id: z.number(),
  title: z.string(),
  link: z.string(),
  body: z.string().optional(),
  owner: z.object({ display_name: z.string().optional() }).optional(),
  creation_date: z.number(),
  score: z.number(),
  answer_count: z.number(),
  is_answered: z.boolean(),
  accepted_answer_id: z.number().optional(),
  view_count: z.number().optional(),
  comment_count: z.number().optional(),
  tags: z.array(z.string()).default([]),
});

const ResponseSchema = z.object({
  items: z.array(ItemSchema).default([]),
  quota_remaining: z.number().optional(),
  backoff: z.number().optional(),
  has_more: z.boolean().optional(),
});

/** Stop early so we never burn the last of the daily quota. */
const MIN_QUOTA = 10;

export async function collectStackOverflow(input: CollectorInput): Promise<CollectorResult> {
  const posts: Post[] = [];
  const warnings: string[] = [];
  let quotaRemaining: number | null = null;
  let requests = 0;
  let failures = 0;
  let waitSeconds = 0;

  for (const keyword of input.keywords) {
    if (quotaRemaining !== null && quotaRemaining < MIN_QUOTA) {
      warnings.push(`Stopped early: only ${quotaRemaining} Stack Exchange requests left today.`);
      break;
    }
    // Obey a backoff instruction from the previous response.
    if (waitSeconds > 0) {
      await sleep(waitSeconds * 1000);
      waitSeconds = 0;
    }

    const params = new URLSearchParams({
      site: "stackoverflow",
      q: keyword,
      fromdate: String(Math.floor(input.start.getTime() / 1000)),
      todate: String(Math.floor(input.end.getTime() / 1000)),
      pagesize: "100",
      sort: "creation",
      order: "desc",
      filter: "withbody",
    });
    const key = process.env.STACKEXCHANGE_KEY;
    if (key) params.set("key", key);

    try {
      requests++;
      const { data } = await fetchJson(`https://api.stackexchange.com/2.3/search/advanced?${params}`, ResponseSchema);
      if (data.quota_remaining !== undefined) quotaRemaining = data.quota_remaining;
      if (data.backoff) waitSeconds = data.backoff;
      for (const item of data.items) {
        posts.push({
          source: "stackoverflow",
          externalId: String(item.question_id),
          url: item.link,
          title: decodeEntities(item.title),
          body: stripHtml(item.body),
          authorHandle: item.owner?.display_name ? decodeEntities(item.owner.display_name) : null,
          createdAt: new Date(item.creation_date * 1000),
          score: item.score,
          commentCount: item.answer_count + (item.comment_count ?? 0),
          answerCount: item.answer_count,
          isAnswered: item.is_answered,
          hasAcceptedAnswer: item.accepted_answer_id !== undefined,
          viewCount: item.view_count ?? null,
          state: null,
          tags: item.tags,
        });
      }
    } catch (err) {
      failures++;
      warnings.push(`"${keyword}": ${errorMessage(err)}`);
      // A throttle error means more requests will also fail: stop now.
      if (err instanceof HttpError && (err.status === 400 || err.status === 429 || err.status === 502)) {
        if (/throttle|quota/i.test(err.message)) {
          warnings.push("Stack Exchange throttled this IP; stopping Stack Overflow collection for this run.");
          break;
        }
      }
    }
  }

  if (requests > 0 && failures === requests) {
    throw new Error(`All ${failures} Stack Overflow searches failed. First error: ${warnings[0]}`);
  }
  return { posts, quotaRemaining, requests, warnings };
}
