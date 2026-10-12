// The one normalised shape every collector returns, plus shared helpers.
import { z } from "zod";

export const SOURCES = ["hackernews", "stackoverflow", "github", "devto"] as const;
export type SourceName = (typeof SOURCES)[number];

export const SOURCE_LABELS: Record<SourceName, string> = {
  hackernews: "Hacker News",
  stackoverflow: "Stack Overflow",
  github: "GitHub Issues",
  devto: "Dev.to",
};

/** A post as collected, before it is stored. */
export interface Post {
  source: SourceName;
  externalId: string;
  url: string;
  title: string;
  body: string; // plain text, HTML already stripped
  authorHandle: string | null; // stored for attribution in the UI only, never sent to Gemini
  createdAt: Date;
  score: number;
  commentCount: number;
  answerCount: number | null; // Stack Overflow only
  isAnswered: boolean | null; // Stack Overflow only
  hasAcceptedAnswer: boolean | null; // Stack Overflow only
  viewCount: number | null; // Stack Overflow only
  state: string | null; // GitHub only: 'open' | 'closed'
  tags: string[];
}

export interface CollectorInput {
  keywords: string[];
  devtoTags: string[];
  start: Date;
  end: Date;
}

export interface CollectorResult {
  posts: Post[];
  quotaRemaining: number | null;
  requests: number;
  warnings: string[];
}

/** What we record per source in runs.source_status. */
export interface SourceStatus {
  ok: boolean;
  count: number;
  error: string | null;
  quotaRemaining: number | null;
  requests: number;
  warnings: string[];
}

/** Each HTTP request gets its own 20-second timeout. */
export const REQUEST_TIMEOUT_MS = 20_000;

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Error carrying the HTTP status, so collectors can react to rate limits. */
export class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
    public headers: Headers,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/**
 * Fetches a URL, checks the status, and validates the JSON body with a zod schema.
 * Any response that does not match the schema is rejected instead of trusted.
 */
export async function fetchJson<T>(
  url: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
): Promise<{ data: T; headers: Headers }> {
  const res = await fetch(url, {
    ...init,
    headers: { "User-Agent": "SignalForge/1.0 (developer intelligence brief)", Accept: "application/json", ...init.headers },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new HttpError(`HTTP ${res.status} from ${new URL(url).hostname}: ${text.slice(0, 200)}`, res.status, res.headers);
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON from ${new URL(url).hostname}`);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`Unexpected response shape from ${new URL(url).hostname}: ${parsed.error.issues[0]?.message ?? "invalid"}`);
  }
  return { data: parsed.data, headers: res.headers };
}

/** Runs async work over items with at most `limit` running at once. Keeps input order. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === "TimeoutError" || err.name === "AbortError") return "Request timed out after 20 seconds";
    return err.message;
  }
  return String(err);
}
