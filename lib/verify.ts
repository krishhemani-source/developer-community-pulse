// Stage 6: verification, in code. "Nothing unverified reaches Sumit."
// Gemini's brief is treated as a draft. Every item must point at real posts that we sent it,
// for the right topic or objection, and must contain no numbers (numbers come from code only).
// Pure function, unit-tested in tests/verify.test.ts.
import type { RawBrief } from "./ai/schemas";

/** What we know about each temporary evidence id we sent to Gemini. */
export interface EvidenceRef {
  topicId: number;
  objectionId: number | null;
}

export interface VerifyReport {
  itemsReceived: number;
  itemsKept: number;
  evidenceIdsRemoved: number; // ids that did not exist or belonged to another topic/objection
  itemsDroppedNoEvidence: number; // items left with zero valid evidence
  itemsDroppedDigits: number; // items whose text contained a digit
  itemsDroppedUnknownId: number; // topic or objection ids we never sent
  headlineReplaced: boolean; // headline contained a digit, so a code-written one is used
}

export interface VerifiedBrief {
  headline: string | null;
  topPainPoints: { topicId: number; insight: string; evidenceIds: string[] }[];
  underserved: { topicId: number; whyUnresolved: string; evidenceIds: string[] }[];
  objectionSignals: { objectionId: number; whatDevelopersSay: string; evidenceIds: string[] }[];
  talkingPoints: string[];
  report: VerifyReport;
}

export function containsDigit(text: string): boolean {
  return /\d/.test(text);
}

export function verifyBrief(
  raw: RawBrief,
  evidence: Map<string, EvidenceRef>,
  validTopicIds: Set<number>,
  validObjectionIds: Set<number>,
): VerifiedBrief {
  const report: VerifyReport = {
    itemsReceived: 0,
    itemsKept: 0,
    evidenceIdsRemoved: 0,
    itemsDroppedNoEvidence: 0,
    itemsDroppedDigits: 0,
    itemsDroppedUnknownId: 0,
    headlineReplaced: false,
  };

  /** Keeps only ids that exist and match; counts the rest as removed. */
  function filterIds(ids: string[], matches: (ref: EvidenceRef) => boolean): string[] {
    const kept = [...new Set(ids)].filter((id) => {
      const ref = evidence.get(id);
      return ref !== undefined && matches(ref);
    });
    report.evidenceIdsRemoved += ids.length - kept.length;
    return kept;
  }

  /** Shared checks for one item. Returns the valid evidence ids, or null to drop the item. */
  function check(text: string, idIsValid: boolean, ids: string[], matches: (ref: EvidenceRef) => boolean): string[] | null {
    report.itemsReceived++;
    if (!idIsValid) {
      report.itemsDroppedUnknownId++;
      return null;
    }
    if (containsDigit(text)) {
      report.itemsDroppedDigits++;
      return null;
    }
    const kept = filterIds(ids, matches);
    if (kept.length === 0) {
      report.itemsDroppedNoEvidence++;
      return null;
    }
    report.itemsKept++;
    return kept;
  }

  const topPainPoints: VerifiedBrief["topPainPoints"] = [];
  const seenTopics = new Set<number>();
  for (const item of raw.top_pain_points.slice(0, 5)) {
    if (seenTopics.has(item.topic_id)) continue; // one insight per topic
    const ids = check(item.insight, validTopicIds.has(item.topic_id), item.evidence_ids, (r) => r.topicId === item.topic_id);
    if (ids) {
      seenTopics.add(item.topic_id);
      topPainPoints.push({ topicId: item.topic_id, insight: item.insight.trim(), evidenceIds: ids });
    }
  }

  const underserved: VerifiedBrief["underserved"] = [];
  for (const item of raw.underserved.slice(0, 3)) {
    const ids = check(item.why_unresolved, validTopicIds.has(item.topic_id), item.evidence_ids, (r) => r.topicId === item.topic_id);
    if (ids) underserved.push({ topicId: item.topic_id, whyUnresolved: item.why_unresolved.trim(), evidenceIds: ids });
  }

  const objectionSignals: VerifiedBrief["objectionSignals"] = [];
  for (const item of raw.objection_signals) {
    const ids = check(
      item.what_developers_say,
      validObjectionIds.has(item.objection_id),
      item.evidence_ids,
      (r) => r.objectionId === item.objection_id,
    );
    if (ids) objectionSignals.push({ objectionId: item.objection_id, whatDevelopersSay: item.what_developers_say.trim(), evidenceIds: ids });
  }

  // Talking points carry no evidence ids, but they still must not contain numbers.
  const talkingPoints: string[] = [];
  for (const point of raw.monday_talking_points.slice(0, 3)) {
    report.itemsReceived++;
    if (containsDigit(point) || point.trim() === "") {
      report.itemsDroppedDigits++;
      continue;
    }
    report.itemsKept++;
    talkingPoints.push(point.trim());
  }

  let headline: string | null = raw.headline.trim();
  if (headline === "" || containsDigit(headline)) {
    headline = null;
    report.headlineReplaced = true;
  }

  return { headline, topPainPoints, underserved, objectionSignals, talkingPoints, report };
}
