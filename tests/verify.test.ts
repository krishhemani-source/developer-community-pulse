import { describe, expect, it } from "vitest";
import type { RawBrief } from "@/lib/ai/schemas";
import { type EvidenceRef, containsDigit, headlineMentionsAny, verifyBrief } from "@/lib/verify";

const evidence = new Map<string, EvidenceRef>([
  ["e1", { topicId: 1, objectionId: 10 }],
  ["e2", { topicId: 1, objectionId: null }],
  ["e3", { topicId: 2, objectionId: null }],
]);
const topics = new Set([1, 2]);
const objections = new Set([10, 11]);

function raw(over: Partial<RawBrief>): RawBrief {
  return {
    headline: "False positives dominate the discussion this week.",
    top_pain_points: [],
    underserved: [],
    objection_signals: [],
    monday_talking_points: ["One", "Two", "Three"],
    ...over,
  };
}

describe("verifyBrief", () => {
  it("keeps items whose evidence exists for the right topic", () => {
    const v = verifyBrief(
      raw({ top_pain_points: [{ topic_id: 1, insight: "Noisy bots erode trust.", evidence_ids: ["e1", "e2"] }] }),
      evidence,
      topics,
      objections,
    );
    expect(v.topPainPoints).toEqual([{ topicId: 1, insight: "Noisy bots erode trust.", evidenceIds: ["e1", "e2"] }]);
    expect(v.report.evidenceIdsRemoved).toBe(0);
  });

  it("removes made-up ids and ids from another topic", () => {
    const v = verifyBrief(
      raw({ top_pain_points: [{ topic_id: 1, insight: "Ok.", evidence_ids: ["e1", "e99", "e3"] }] }),
      evidence,
      topics,
      objections,
    );
    expect(v.topPainPoints[0].evidenceIds).toEqual(["e1"]);
    expect(v.report.evidenceIdsRemoved).toBe(2);
  });

  it("drops items left with no valid evidence", () => {
    const v = verifyBrief(
      raw({ underserved: [{ topic_id: 2, why_unresolved: "No tool helps.", evidence_ids: ["e1", "fake"] }] }),
      evidence,
      topics,
      objections,
    );
    expect(v.underserved).toHaveLength(0);
    expect(v.report.itemsDroppedNoEvidence).toBe(1);
  });

  it("drops any text containing digits, including the headline", () => {
    const v = verifyBrief(
      raw({
        headline: "Mentions rose 40% this week.",
        top_pain_points: [{ topic_id: 1, insight: "Up 3x since last week.", evidence_ids: ["e1"] }],
        monday_talking_points: ["Ask about the 2 flaky suites", "Discuss noise", "Review context gaps"],
      }),
      evidence,
      topics,
      objections,
    );
    expect(v.headline).toBeNull();
    expect(v.report.headlineReplaced).toBe(true);
    expect(v.topPainPoints).toHaveLength(0);
    expect(v.talkingPoints).toEqual(["Discuss noise", "Review context gaps"]);
    expect(v.report.itemsDroppedDigits).toBe(2);
  });

  it("drops unknown topic or objection ids", () => {
    const v = verifyBrief(
      raw({
        top_pain_points: [{ topic_id: 7, insight: "x", evidence_ids: ["e1"] }],
        objection_signals: [{ objection_id: 99, what_developers_say: "x", evidence_ids: ["e1"] }],
      }),
      evidence,
      topics,
      objections,
    );
    expect(v.topPainPoints).toHaveLength(0);
    expect(v.objectionSignals).toHaveLength(0);
    expect(v.report.itemsDroppedUnknownId).toBe(2);
  });

  it("objection evidence must be a post tagged with that objection", () => {
    const v = verifyBrief(
      raw({
        objection_signals: [
          { objection_id: 10, what_developers_say: "Bots are noisy.", evidence_ids: ["e1", "e2"] },
          { objection_id: 11, what_developers_say: "Too slow.", evidence_ids: ["e1"] },
        ],
      }),
      evidence,
      topics,
      objections,
    );
    expect(v.objectionSignals).toEqual([{ objectionId: 10, whatDevelopersSay: "Bots are noisy.", evidenceIds: ["e1"] }]);
  });

  it("keeps only one insight per topic", () => {
    const v = verifyBrief(
      raw({
        top_pain_points: [
          { topic_id: 1, insight: "First.", evidence_ids: ["e1"] },
          { topic_id: 1, insight: "Second.", evidence_ids: ["e2"] },
        ],
      }),
      evidence,
      topics,
      objections,
    );
    expect(v.topPainPoints.map((p) => p.insight)).toEqual(["First."]);
  });
});

describe("containsDigit", () => {
  it("detects digits", () => {
    expect(containsDigit("a1")).toBe(true);
    expect(containsDigit("no numbers here")).toBe(false);
  });
});

describe("headline grounding", () => {
  const names = ["AI code review tools", "Security and static analysis"];
  it("accepts a headline that names a key topic, even paraphrased", () => {
    expect(headlineMentionsAny("AI code review dominated discussion while noise complaints grew.", names)).toBe(true);
    expect(headlineMentionsAny("Static analysis complaints are rising fastest this week.", names)).toBe(true);
    expect(headlineMentionsAny("Artificial intelligence code review remained the top topic.", names)).toBe(true);
  });
  it("rejects a headline that names neither key topic", () => {
    expect(headlineMentionsAny("Developers discussed many interesting things this week.", names)).toBe(false);
    expect(headlineMentionsAny("Review culture and tools came up a lot.", names)).toBe(false);
  });
  it("replaces an ungrounded headline with the code-written one", () => {
    const v = verifyBrief(raw({ headline: "Developers are busy this week." }), evidence, topics, objections, names);
    expect(v.headline).toBeNull();
    expect(v.report.headlineReplaced).toBe(true);
    expect(v.report.headlineUngrounded).toBe(true);
  });
  it("keeps a grounded headline", () => {
    const v = verifyBrief(raw({ headline: "Security and static analysis is rising while AI code review stays on top." }), evidence, topics, objections, names);
    expect(v.headline).not.toBeNull();
  });
});
