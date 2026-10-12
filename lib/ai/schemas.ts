// The exact shapes we ask Gemini for, defined twice on purpose:
//  1. as a Gemini `responseSchema`, so the model is constrained to produce this JSON;
//  2. as a zod schema, so we never trust the output until we have checked it ourselves.
import { type Schema, Type } from "@google/genai";
import { z } from "zod";

// ---------- Tagging ----------

export const TagItemSchema = z.object({
  id: z.string(),
  relevant: z.boolean(),
  topic_id: z.number().int().nullable(),
  pain_point: z.string(),
  unresolved_signal: z.boolean(),
  objection_id: z.number().int().nullable(),
  confidence: z.number().min(0).max(1),
});
export const TagResponseSchema = z.object({ items: z.array(TagItemSchema) });
export type TagItem = z.infer<typeof TagItemSchema>;

export const tagResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          relevant: { type: Type.BOOLEAN },
          topic_id: { type: Type.INTEGER, nullable: true },
          pain_point: { type: Type.STRING, description: "At most 12 plain words." },
          unresolved_signal: { type: Type.BOOLEAN },
          objection_id: { type: Type.INTEGER, nullable: true },
          confidence: { type: Type.NUMBER, description: "0 to 1" },
        },
        required: ["id", "relevant", "topic_id", "pain_point", "unresolved_signal", "objection_id", "confidence"],
        propertyOrdering: ["id", "relevant", "topic_id", "pain_point", "unresolved_signal", "objection_id", "confidence"],
      },
    },
  },
  required: ["items"],
};

// ---------- Brief ----------

const EvidenceIds = z.array(z.string());

export const RawBriefSchema = z.object({
  headline: z.string(),
  top_pain_points: z.array(z.object({ topic_id: z.number().int(), insight: z.string(), evidence_ids: EvidenceIds })).max(10),
  underserved: z.array(z.object({ topic_id: z.number().int(), why_unresolved: z.string(), evidence_ids: EvidenceIds })).max(10),
  objection_signals: z
    .array(z.object({ objection_id: z.number().int(), what_developers_say: z.string(), evidence_ids: EvidenceIds }))
    .max(20),
  monday_talking_points: z.array(z.string()).max(6),
});
export type RawBrief = z.infer<typeof RawBriefSchema>;

const evidenceIdsSchema: Schema = { type: Type.ARRAY, items: { type: Type.STRING } };

export const briefResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    headline: { type: Type.STRING },
    top_pain_points: {
      type: Type.ARRAY,
      maxItems: "5",
      items: {
        type: Type.OBJECT,
        properties: { topic_id: { type: Type.INTEGER }, insight: { type: Type.STRING }, evidence_ids: evidenceIdsSchema },
        required: ["topic_id", "insight", "evidence_ids"],
      },
    },
    underserved: {
      type: Type.ARRAY,
      maxItems: "3",
      items: {
        type: Type.OBJECT,
        properties: { topic_id: { type: Type.INTEGER }, why_unresolved: { type: Type.STRING }, evidence_ids: evidenceIdsSchema },
        required: ["topic_id", "why_unresolved", "evidence_ids"],
      },
    },
    objection_signals: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          objection_id: { type: Type.INTEGER },
          what_developers_say: { type: Type.STRING },
          evidence_ids: evidenceIdsSchema,
        },
        required: ["objection_id", "what_developers_say", "evidence_ids"],
      },
    },
    monday_talking_points: { type: Type.ARRAY, minItems: "3", maxItems: "3", items: { type: Type.STRING } },
  },
  required: ["headline", "top_pain_points", "underserved", "objection_signals", "monday_talking_points"],
  propertyOrdering: ["headline", "top_pain_points", "underserved", "objection_signals", "monday_talking_points"],
};
