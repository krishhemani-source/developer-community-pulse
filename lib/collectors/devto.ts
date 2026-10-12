// Dev.to via its public articles API. No key needed.
// For each tag in settings we page back through recent articles until we pass the window start,
// then keep only articles whose title, description or tags contain an active keyword.
import { z } from "zod";
import { containsPhrase, stripHtml } from "../text";
import { type CollectorInput, type CollectorResult, type Post, errorMessage, fetchJson } from "./types";

const ArticleSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string().nullish(),
  url: z.string(),
  published_at: z.string(),
  tag_list: z.union([z.array(z.string()), z.string()]).default([]),
  comments_count: z.number().default(0),
  public_reactions_count: z.number().optional(),
  positive_reactions_count: z.number().optional(),
  user: z.object({ username: z.string() }).optional(),
});

const ResponseSchema = z.array(ArticleSchema);

/** At most this many pages of 100 per tag (enough for a week four weeks back on busy tags). */
const MAX_PAGES = 6;

export async function collectDevTo(input: CollectorInput): Promise<CollectorResult> {
  const posts: Post[] = [];
  const warnings: string[] = [];
  let requests = 0;
  let failures = 0;

  for (const tag of input.devtoTags) {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const params = new URLSearchParams({ tag, per_page: "100", page: String(page) });
      let articles: z.infer<typeof ResponseSchema>;
      try {
        requests++;
        ({ data: articles } = await fetchJson(`https://dev.to/api/articles?${params}`, ResponseSchema));
      } catch (err) {
        failures++;
        warnings.push(`tag "${tag}" page ${page}: ${errorMessage(err)}`);
        break;
      }
      if (articles.length === 0) break;

      for (const article of articles) {
        const published = new Date(article.published_at);
        if (published < input.start || published >= input.end) continue;
        const tags = Array.isArray(article.tag_list)
          ? article.tag_list
          : article.tag_list.split(",").map((t) => t.trim());
        const haystack = `${article.title} ${article.description ?? ""} ${tags.join(" ")}`;
        if (!input.keywords.some((kw) => containsPhrase(haystack, kw))) continue;

        posts.push({
          source: "devto",
          externalId: String(article.id),
          url: article.url,
          title: article.title,
          body: stripHtml(article.description),
          authorHandle: article.user?.username ?? null,
          createdAt: published,
          score: article.public_reactions_count ?? article.positive_reactions_count ?? 0,
          commentCount: article.comments_count,
          answerCount: null,
          isAnswered: null,
          hasAcceptedAnswer: null,
          viewCount: null,
          state: null,
          tags,
        });
      }

      // Articles come newest first. Once the oldest on this page is before the window, stop paging.
      const oldest = new Date(articles[articles.length - 1].published_at);
      if (oldest < input.start) break;
    }
  }

  if (requests > 0 && failures === requests) {
    throw new Error(`All ${failures} Dev.to requests failed. First error: ${warnings[0]}`);
  }
  return { posts, quotaRemaining: null, requests, warnings };
}
