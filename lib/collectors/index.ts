// Runs all four collectors in parallel. One source failing never stops the others:
// Promise.allSettled waits for every collector and we record each one's outcome.
import { collectDevTo } from "./devto";
import { collectGitHub } from "./github";
import { collectHackerNews } from "./hackernews";
import { collectStackOverflow } from "./stackoverflow";
import {
  type CollectorInput,
  type CollectorResult,
  type Post,
  SOURCES,
  type SourceName,
  type SourceStatus,
  errorMessage,
} from "./types";

const COLLECTORS: Record<SourceName, (input: CollectorInput) => Promise<CollectorResult>> = {
  hackernews: collectHackerNews,
  stackoverflow: collectStackOverflow,
  github: collectGitHub,
  devto: collectDevTo,
};

export interface CollectAllResult {
  posts: Post[];
  sourceStatus: Record<SourceName, SourceStatus>;
  anyFailed: boolean;
}

export async function collectAll(input: CollectorInput): Promise<CollectAllResult> {
  const settled = await Promise.allSettled(SOURCES.map((source) => COLLECTORS[source](input)));

  const posts: Post[] = [];
  const sourceStatus = {} as Record<SourceName, SourceStatus>;
  let anyFailed = false;

  settled.forEach((result, i) => {
    const source = SOURCES[i];
    if (result.status === "fulfilled") {
      posts.push(...result.value.posts);
      sourceStatus[source] = {
        ok: true,
        count: result.value.posts.length,
        error: null,
        quotaRemaining: result.value.quotaRemaining,
        requests: result.value.requests,
        warnings: result.value.warnings.slice(0, 10),
      };
    } else {
      anyFailed = true;
      sourceStatus[source] = {
        ok: false,
        count: 0,
        error: errorMessage(result.reason),
        quotaRemaining: null,
        requests: 0,
        warnings: [],
      };
    }
  });

  return { posts, sourceStatus, anyFailed };
}
