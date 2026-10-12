import { describe, expect, it } from "vitest";
import { isAutomatedIssue } from "@/lib/collectors/github";
import { interleaveByTopic } from "@/lib/config";

describe("interleaveByTopic", () => {
  it("orders keywords round-robin so a partial search still covers every topic", () => {
    const kw = [
      { topic_id: 1, phrase: "a1" },
      { topic_id: 1, phrase: "a2" },
      { topic_id: 2, phrase: "b1" },
      { topic_id: 3, phrase: "c1" },
      { topic_id: 3, phrase: "c2" },
      { topic_id: 3, phrase: "c3" },
    ];
    expect(interleaveByTopic(kw)).toEqual(["a1", "b1", "c1", "a2", "c2", "c3"]);
  });
  it("seven topics of five keywords: the first 12 searched touch all seven topics", () => {
    const kw = Array.from({ length: 7 }, (_, t) => Array.from({ length: 5 }, (_, i) => ({ topic_id: t + 1, phrase: `t${t + 1}k${i}` }))).flat();
    const first12 = interleaveByTopic(kw).slice(0, 12);
    expect(new Set(first12.map((p) => p.split("k")[0])).size).toBe(7);
  });
});

describe("isAutomatedIssue", () => {
  it("flags bot accounts", () => {
    expect(isAutomatedIssue({ title: "Bump lodash", user: { login: "dependabot[bot]", type: "Bot" } })).toBe(true);
    expect(isAutomatedIssue({ title: "Flaky tests", user: { login: "ci-bot" } })).toBe(true);
  });
  it("flags the automated reports and boards seen in real runs", () => {
    for (const title of ["COORD BOARD (controllers)", "Campaign board: launch finish", "[CI Monitor] Daily Report - 2026-10-08", "Dependency Dashboard", "Tracking issue for v2 migration"]) {
      expect(isAutomatedIssue({ title, user: { login: "someone", type: "User" } })).toBe(true);
    }
  });
  it("keeps real developer issues", () => {
    for (const title of [
      "deferinloop: range-over-func false-positives",
      "GitHub Actions slow on large monorepo",
      "Review bot comments are too noisy to be useful",
    ]) {
      expect(isAutomatedIssue({ title, user: { login: "dev", type: "User" } })).toBe(false);
    }
  });
});
