import { describe, expect, it } from "vitest";
import { capPosts, dedupePosts } from "@/lib/pipeline/clean";
import type { Post } from "@/lib/collectors/types";
import {
  type MeasuredPost,
  resolutionStatus,
  streak,
  topicWeekStats,
  underservedScores,
  weekChange,
  objectionCounts,
} from "@/lib/metrics";

const WEEK_END = new Date("2026-10-09T02:30:00Z");
const OLD = new Date("2026-10-04T00:00:00Z"); // 5 days before week end
const FRESH = new Date("2026-10-08T12:00:00Z"); // 14.5 hours before week end

function post(over: Partial<MeasuredPost>): MeasuredPost {
  return {
    postId: 1,
    topicId: 1,
    objectionId: null,
    painPoint: "",
    unresolvedSignal: false,
    source: "stackoverflow",
    createdAt: OLD,
    hasAcceptedAnswer: false,
    isAnswered: false,
    answerCount: 0,
    state: null,
    commentCount: 0,
    score: 0,
    ...over,
  };
}

describe("resolutionStatus", () => {
  it("Stack Overflow: accepted answer is resolved", () => {
    expect(resolutionStatus(post({ hasAcceptedAnswer: true, isAnswered: true, answerCount: 2 }), WEEK_END, 48)).toBe("resolved");
  });
  it("Stack Overflow: answered without accepted answer is partly resolved", () => {
    expect(resolutionStatus(post({ isAnswered: true, answerCount: 1 }), WEEK_END, 48)).toBe("partly_resolved");
  });
  it("Stack Overflow: answers but not answered is unresolved", () => {
    expect(resolutionStatus(post({ answerCount: 2 }), WEEK_END, 48)).toBe("unresolved");
  });
  it("Stack Overflow: zero answers is unanswered", () => {
    expect(resolutionStatus(post({}), WEEK_END, 48)).toBe("unanswered");
  });
  it("GitHub: closed is resolved, open with 3+ comments is unresolved, quiet open is not judged", () => {
    expect(resolutionStatus(post({ source: "github", state: "closed" }), WEEK_END, 48)).toBe("resolved");
    expect(resolutionStatus(post({ source: "github", state: "open", commentCount: 3 }), WEEK_END, 48)).toBe("unresolved");
    expect(resolutionStatus(post({ source: "github", state: "open", commentCount: 2 }), WEEK_END, 48)).toBe("open_quiet");
  });
  it("Hacker News and Dev.to use the unresolved signal", () => {
    expect(resolutionStatus(post({ source: "hackernews", unresolvedSignal: true }), WEEK_END, 48)).toBe("unresolved");
    expect(resolutionStatus(post({ source: "devto", unresolvedSignal: false }), WEEK_END, 48)).toBe("no_signal");
  });
  it("posts younger than the minimum age are too new", () => {
    expect(resolutionStatus(post({ createdAt: FRESH }), WEEK_END, 48)).toBe("too_new");
    expect(resolutionStatus(post({ createdAt: FRESH }), WEEK_END, 0)).toBe("unanswered");
  });
});

describe("topicWeekStats", () => {
  it("counts mentions, engagement and unresolved share, excluding too-new posts from the share", () => {
    const stats = topicWeekStats(
      [
        post({ score: 5, commentCount: 2, hasAcceptedAnswer: true }), // resolved
        post({ score: 1, commentCount: 0 }), // unanswered
        post({ score: 0, commentCount: 3, answerCount: 3 }), // unresolved
        post({ createdAt: FRESH, score: 10 }), // too new
      ],
      WEEK_END,
      48,
    );
    expect(stats.mentionCount).toBe(4);
    expect(stats.engagement).toBe(5 + 2 + 1 + 0 + 3 + 10);
    expect(stats.judgedCount).toBe(3);
    expect(stats.unresolvedCount).toBe(2);
    expect(stats.resolvedCount).toBe(1);
    expect(stats.unresolvedShare).toBeCloseTo(2 / 3);
    expect(stats.resolution.too_new).toBe(1);
  });
  it("returns a null share when nothing can be judged", () => {
    expect(topicWeekStats([], WEEK_END, 48).unresolvedShare).toBeNull();
    expect(topicWeekStats([post({ createdAt: FRESH })], WEEK_END, 48).unresolvedShare).toBeNull();
  });
});

describe("weekChange", () => {
  const T = 5;
  it("no stored previous week", () => {
    expect(weekChange(8, null, T)).toEqual({ delta: null, pct: null, label: "no history" });
  });
  it("new: zero last week, something now (above threshold)", () => {
    expect(weekChange(6, 0, T).label).toBe("new");
  });
  it("low signal when both weeks are below the threshold, and percentage hidden", () => {
    expect(weekChange(4, 1, T)).toEqual({ delta: 3, pct: null, label: "low signal" });
    expect(weekChange(3, 0, T).label).toBe("low signal");
  });
  it("rising needs +25% AND at least +3", () => {
    expect(weekChange(14, 4, T).label).toBe("rising"); // previous below threshold: pct hidden
    expect(weekChange(14, 4, T).pct).toBeNull();
    expect(weekChange(13, 10, T)).toEqual({ delta: 3, pct: 30, label: "rising" });
    expect(weekChange(42, 40, T).label).toBe("steady"); // +2: below the absolute minimum
    expect(weekChange(44, 40, T).label).toBe("steady"); // +4 but only +10%
  });
  it("falling needs -25% AND at least -3", () => {
    expect(weekChange(6, 10, T)).toEqual({ delta: -4, pct: -40, label: "falling" });
    expect(weekChange(8, 10, T).label).toBe("steady");
  });
  it("shows percentage only when last week met the threshold", () => {
    expect(weekChange(10, 5, T).pct).toBe(100);
    expect(weekChange(10, 4, T).pct).toBeNull();
  });
});

describe("streak", () => {
  it("counts consecutive rising weeks ending now", () => {
    expect(streak([5, 8, 12, 18], 5)).toEqual({ direction: "rising", weeks: 3 });
  });
  it("stops at the first non-rising week", () => {
    expect(streak([20, 8, 12, 18], 5)).toEqual({ direction: "rising", weeks: 2 });
  });
  it("counts falling streaks", () => {
    expect(streak([30, 20, 12], 5)).toEqual({ direction: "falling", weeks: 2 });
  });
  it("steady or single week means no streak", () => {
    expect(streak([10, 10], 5)).toEqual({ direction: null, weeks: 0 });
    expect(streak([10], 5)).toEqual({ direction: null, weeks: 0 });
  });
  it("a direction change ends the streak", () => {
    expect(streak([10, 20, 10], 5)).toEqual({ direction: "falling", weeks: 1 });
  });
});

describe("underservedScores", () => {
  it("normalises mentions against the busiest topic and multiplies by unresolved share", () => {
    expect(
      underservedScores([
        { mentionCount: 20, unresolvedShare: 0.5 },
        { mentionCount: 10, unresolvedShare: 1 },
        { mentionCount: 5, unresolvedShare: null },
      ]),
    ).toEqual([0.5, 0.5, 0]);
  });
  it("is zero when nothing was mentioned", () => {
    expect(underservedScores([{ mentionCount: 0, unresolvedShare: null }])).toEqual([0]);
  });
});

describe("objectionCounts", () => {
  it("counts posts per objection and ignores untagged posts", () => {
    const counts = objectionCounts([{ objectionId: 1 }, { objectionId: 1 }, { objectionId: 3 }, { objectionId: null }]);
    expect(counts.get(1)).toBe(2);
    expect(counts.get(3)).toBe(1);
    expect(counts.size).toBe(2);
  });
});

describe("cleaning", () => {
  const base: Post = {
    source: "hackernews",
    externalId: "1",
    url: "https://news.ycombinator.com/item?id=1",
    title: "t",
    body: "",
    authorHandle: null,
    createdAt: OLD,
    score: 0,
    commentCount: 0,
    answerCount: null,
    isAnswered: null,
    hasAcceptedAnswer: null,
    viewCount: null,
    state: null,
    tags: [],
  };
  it("dedupes by source id, then by normalised URL", () => {
    const { unique, duplicates } = dedupePosts([
      base,
      { ...base }, // same id
      { ...base, externalId: "2", url: "https://www.news.ycombinator.com/item?id=1#x" }, // same URL
      { ...base, externalId: "3", url: "https://news.ycombinator.com/item?id=3" },
    ]);
    expect(unique.map((p) => p.externalId)).toEqual(["1", "3"]);
    expect(duplicates).toBe(2);
  });
  it("caps by engagement", () => {
    const posts = [1, 5, 3].map((score, i) => ({ ...base, externalId: String(i), score }));
    const { kept, dropped } = capPosts(posts, 2);
    expect(kept.map((p) => p.score)).toEqual([5, 3]);
    expect(dropped).toBe(1);
  });
});
