// GitHub Issues via the Search API (/search/issues).
// The search API allows 10 requests/minute without a token and 30/minute with GITHUB_TOKEN,
// so requests are spaced out, and collection stops when the time budget runs out.
import { z } from "zod";
import { stripHtml } from "../text";
import { type CollectorInput, type CollectorResult, type Post, HttpError, errorMessage, fetchJson, sleep } from "./types";

const IssueSchema = z.object({
  id: z.number(),
  html_url: z.string(),
  title: z.string(),
  body: z.string().nullish(),
  user: z.object({ login: z.string() }).nullish(),
  created_at: z.string(),
  state: z.string(),
  comments: z.number(),
  reactions: z.object({ total_count: z.number() }).optional(),
  labels: z.array(z.object({ name: z.string() })).default([]),
  pull_request: z.unknown().optional(),
});

const ResponseSchema = z.object({ items: z.array(IssueSchema) });

/** Total time GitHub collection may take, so the whole run fits inside Vercel's limit. */
const TIME_BUDGET_MS = 80_000;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 19) + "Z";
}

export async function collectGitHub(input: CollectorInput): Promise<CollectorResult> {
  const token = process.env.GITHUB_TOKEN;
  const spacingMs = token ? 2_100 : 6_100; // 30/min with a token, 10/min without
  const deadline = Date.now() + TIME_BUDGET_MS;
  const posts: Post[] = [];
  const warnings: string[] = [];
  let quotaRemaining: number | null = null;
  let requests = 0;
  let failures = 0;
  let searched = 0;

  for (const keyword of input.keywords) {
    if (Date.now() + spacingMs > deadline) {
      warnings.push(
        `Searched ${searched} of ${input.keywords.length} keywords before the time budget ran out${token ? "" : " (add GITHUB_TOKEN to search all keywords)"}.`,
      );
      break;
    }
    if (requests > 0) await sleep(spacingMs);

    const q = `"${keyword}" created:${isoDate(input.start)}..${isoDate(input.end)} is:issue`;
    // 10 most-discussed issues per keyword: enough signal without GitHub drowning out the other sources.
    const params = new URLSearchParams({ q, per_page: "10", sort: "comments", order: "desc" });
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    try {
      requests++;
      const { data, headers: resHeaders } = await fetchJson(`https://api.github.com/search/issues?${params}`, ResponseSchema, {
        headers,
      });
      searched++;
      const remaining = resHeaders.get("x-ratelimit-remaining");
      if (remaining !== null) quotaRemaining = Number(remaining);
      for (const issue of data.items) {
        if (issue.pull_request) continue; // belt and braces: issues only
        posts.push({
          source: "github",
          externalId: String(issue.id),
          url: issue.html_url,
          title: issue.title,
          body: stripHtml(issue.body),
          authorHandle: issue.user?.login ?? null,
          createdAt: new Date(issue.created_at),
          score: issue.reactions?.total_count ?? 0,
          commentCount: issue.comments,
          answerCount: null,
          isAnswered: null,
          hasAcceptedAnswer: null,
          viewCount: null,
          state: issue.state,
          tags: issue.labels.map((l) => l.name),
        });
      }
    } catch (err) {
      failures++;
      warnings.push(`"${keyword}": ${errorMessage(err)}`);
      if (err instanceof HttpError && (err.status === 403 || err.status === 429)) {
        warnings.push("GitHub rate limit reached; stopping GitHub collection for this run.");
        break;
      }
    }
  }

  if (requests > 0 && failures === requests) {
    throw new Error(`All ${failures} GitHub searches failed. First error: ${warnings[0]}`);
  }
  return { posts, quotaRemaining, requests, warnings };
}
