// Stage 2: clean. Deduplicate, strip and trim text, cap the run size, and store posts.
import type { Post, SourceName } from "../collectors/types";
import { query } from "../db";
import { engagementOf } from "../metrics";
import { normaliseUrl, stripHtml, truncate } from "../text";

export const MAX_POSTS_PER_RUN = 400;
export const EXCERPT_LENGTH = 600;

export interface StoredPost extends Post {
  id: number; // posts.id in the database
}

/** Removes duplicates: first by (source, external id), then by normalised URL. */
export function dedupePosts(posts: Post[]): { unique: Post[]; duplicates: number } {
  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();
  const unique: Post[] = [];
  for (const post of posts) {
    const idKey = `${post.source}:${post.externalId}`;
    const urlKey = normaliseUrl(post.url);
    if (seenIds.has(idKey) || seenUrls.has(urlKey)) continue;
    seenIds.add(idKey);
    seenUrls.add(urlKey);
    unique.push(post);
  }
  return { unique, duplicates: posts.length - unique.length };
}

/** Keeps the highest-engagement posts when there are more than the cap. */
export function capPosts(posts: Post[], max = MAX_POSTS_PER_RUN): { kept: Post[]; dropped: number } {
  if (posts.length <= max) return { kept: posts, dropped: 0 };
  const sorted = [...posts].sort((a, b) => engagementOf(b) - engagementOf(a));
  return { kept: sorted.slice(0, max), dropped: posts.length - max };
}

/** Plain text, excerpt length, no stray HTML. */
export function tidyPost(post: Post): Post {
  return {
    ...post,
    title: truncate(stripHtml(post.title) || "Untitled", 300),
    body: truncate(stripHtml(post.body), EXCERPT_LENGTH),
  };
}

const COLUMNS = 15;

/** Inserts posts, or refreshes counts on posts we already have. Returns them with database ids. */
async function upsertPosts(posts: Post[]): Promise<StoredPost[]> {
  const stored: StoredPost[] = [];
  for (let i = 0; i < posts.length; i += 100) {
    const chunk = posts.slice(i, i + 100);
    const params: unknown[] = [];
    const rows = chunk.map((p, r) => {
      params.push(
        p.source,
        p.externalId,
        p.url,
        p.title,
        p.body,
        p.authorHandle,
        p.createdAt.toISOString(),
        p.score,
        p.commentCount,
        p.answerCount,
        p.isAnswered,
        p.hasAcceptedAnswer,
        p.viewCount,
        p.state,
        p.tags,
      );
      const b = r * COLUMNS;
      const ph = (n: number) => `$${b + n}`;
      return `(${ph(1)}, ${ph(2)}, ${ph(3)}, ${ph(4)}, ${ph(5)}, ${ph(6)}, ${ph(7)}::timestamptz, ${ph(8)}, ${ph(9)}, ${ph(10)}, ${ph(11)}, ${ph(12)}, ${ph(13)}, ${ph(14)}, ${ph(15)}::text[], now())`;
    });

    const result = await query<{ id: number; source: SourceName; external_id: string }>(
      `INSERT INTO posts (source, external_id, url, title, body_excerpt, author_handle, created_at_source, score,
                          comment_count, answer_count, is_answered, has_accepted_answer, view_count, state, raw_tags, fetched_at)
       VALUES ${rows.join(", ")}
       ON CONFLICT (source, external_id) DO UPDATE SET
         url = EXCLUDED.url, title = EXCLUDED.title, body_excerpt = EXCLUDED.body_excerpt,
         score = EXCLUDED.score, comment_count = EXCLUDED.comment_count, answer_count = EXCLUDED.answer_count,
         is_answered = EXCLUDED.is_answered, has_accepted_answer = EXCLUDED.has_accepted_answer,
         view_count = EXCLUDED.view_count, state = EXCLUDED.state, raw_tags = EXCLUDED.raw_tags, fetched_at = now()
       RETURNING id, source, external_id`,
      params,
    );
    const idByKey = new Map(result.map((r) => [`${r.source}:${r.external_id}`, r.id]));
    for (const p of chunk) {
      const id = idByKey.get(`${p.source}:${p.externalId}`);
      if (id !== undefined) stored.push({ ...p, id });
    }
  }
  return stored;
}

export interface CleanResult {
  posts: StoredPost[];
  duplicates: number;
  droppedByCap: number;
}

export async function cleanAndStore(raw: Post[]): Promise<CleanResult> {
  const { unique, duplicates } = dedupePosts(raw);
  const { kept, dropped } = capPosts(unique.map(tidyPost));
  const posts = await upsertPosts(kept);
  return { posts, duplicates, droppedByCap: dropped };
}
