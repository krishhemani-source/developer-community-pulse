// Stage 5: Gemini drafts the words of the brief from numbers that code already computed.
// It receives only metrics and, per topic, the top 5 posts (temporary id, title, pain point, source).
// It is told not to write numbers; the UI and email place code-computed numbers next to its words.
import type { SourceName } from "../collectors/types";
import { type GeminiCounter, generateJson } from "./gemini";
import { type RawBrief, RawBriefSchema, briefResponseSchema } from "./schemas";

export interface BriefTopicInput {
  topic_id: number;
  name: string;
  mention_count: number;
  change_vs_last_week: number | null;
  trend: string;
  streak: string | null;
  unresolved_share: number | null;
  underserved_score: number;
  top_posts: { id: string; title: string; pain_point: string; source: SourceName; objection_id: number | null }[];
}

export interface BriefInput {
  topics: BriefTopicInput[];
  objections: { objection_id: number; label: string; matching_posts: number }[];
  missing_sources: string[];
}

const SYSTEM = `You write a weekly developer community brief for Sumit, the only PM at a startup that sells a code review automation tool.
He reads it in under ten minutes before his engineering sync. All numbers have already been computed by code.

Hard rules:
- Do NOT write any digits, numbers or percentages anywhere. Say "most discussed", "rising", "mostly unresolved" instead. Numbers are shown next to your text by the app.
- Every item must cite evidence_ids, using ONLY the post ids given under that topic. For objection_signals, cite only posts whose objection_id matches.
- Plain words, short sentences, no hype, no emoji. Never use the word "delve".
- Describe what developers say. Do not recommend what to build; Sumit decides that.

Fields:
- headline: two or three sentences with the single most important takeaway this week.
- top_pain_points: up to five topics with discussion, most important first. insight = one or two sentences on what developers are struggling with.
- underserved: up to three topics that are both frequently discussed and mostly unresolved. why_unresolved = what is missing for developers.
- objection_signals: for each sales objection with matching posts, what developers are saying in their own terms.
- monday_talking_points: exactly three short points Sumit can raise in sprint planning.`;

export async function writeBrief(input: BriefInput, counter: GeminiCounter): Promise<RawBrief> {
  const prompt = `This week's computed metrics and evidence:\n\n${JSON.stringify(input)}`;
  return generateJson({ system: SYSTEM, prompt, responseSchema: briefResponseSchema, validator: RawBriefSchema, counter });
}
