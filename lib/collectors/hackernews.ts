// Hacker News via the public Algolia search API. No key needed.
// One search per keyword, stories and comments, limited to the week window.
import { z } from "zod";
import { stripHtml } from "../text";
import { type CollectorInput, type CollectorResult, type Post, errorMessage, fetchJson, mapLimit } from "./types";

const HitSchema = z.object({
  objectID: z.string(),
  title: z.string().nullish(),
  story_title: z.string().nullish(),
  story_text: z.string().nullish(),
  comment_text: z.string().nullish(),
  url: z.string().nullish(),
  author: z.string().nullish(),
  created_at_i: z.number(),
  points: z.number().nullish(),
  num_comments: z.number().nullish(),
  _tags: z.array(z.string()).default([]),
});

const ResponseSchema = z.object({ hits: z.array(HitSchema) });

export async function collectHackerNews(input: CollectorInput): Promise<CollectorResult> {
  const start = Math.floor(input.start.getTime() / 1000);
  const end = Math.floor(input.end.getTime() / 1000);
  const warnings: string[] = [];
  let requests = 0;
  let failures = 0;

  const perKeyword = await mapLimit(input.keywords, 4, async (keyword) => {
    const params = new URLSearchParams({
      query: `"${keyword}"`, // quotes ask Algolia for the exact phrase
      tags: "(story,comment)",
      numericFilters: `created_at_i>${start},created_at_i<${end}`,
      hitsPerPage: "50",
    });
    try {
      requests++;
      const { data } = await fetchJson(`https://hn.algolia.com/api/v1/search_by_date?${params}`, ResponseSchema);
      return data.hits.map((hit): Post => {
        const isComment = hit._tags.includes("comment");
        const title = isComment
          ? `Comment on: ${hit.story_title ?? "Hacker News thread"}`
          : (hit.title ?? hit.story_title ?? "Untitled");
        return {
          source: "hackernews",
          externalId: hit.objectID,
          url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
          title: stripHtml(title),
          body: stripHtml(isComment ? hit.comment_text : (hit.story_text ?? "")),
          authorHandle: hit.author ?? null,
          createdAt: new Date(hit.created_at_i * 1000),
          score: hit.points ?? 0,
          commentCount: hit.num_comments ?? 0,
          answerCount: null,
          isAnswered: null,
          hasAcceptedAnswer: null,
          viewCount: null,
          state: null,
          tags: hit._tags.filter((t) => t === "story" || t === "comment" || t.startsWith("ask_hn") || t === "show_hn"),
        };
      });
    } catch (err) {
      failures++;
      warnings.push(`"${keyword}": ${errorMessage(err)}`);
      return [];
    }
  });

  // If every single request failed, the source is down: report it as a failure.
  if (failures > 0 && failures === input.keywords.length) {
    throw new Error(`All ${failures} Hacker News searches failed. First error: ${warnings[0]}`);
  }
  return { posts: perKeyword.flat(), quotaRemaining: null, requests, warnings };
}
