// Reads Sumit's editable config (topics, keywords, objections, settings) from the database.
import { z } from "zod";
import { query } from "./db";

export interface Topic {
  id: number;
  name: string;
  description: string;
  color: string;
  is_active: boolean;
  sort_order: number;
}

export interface Keyword {
  id: number;
  topic_id: number;
  phrase: string;
  is_active: boolean;
}

export interface Objection {
  id: number;
  label: string;
  description: string;
  is_active: boolean;
}

export const DEFAULT_DEVTO_TAGS = ["codereview", "cicd", "devops", "githubactions", "testing", "productivity"];

/** Settings live in a key/value table; this schema fills in safe defaults for anything missing. */
export const SettingsSchema = z.object({
  recipient_email: z.string().default(""),
  devto_tags: z.array(z.string()).default(DEFAULT_DEVTO_TAGS),
  timezone: z.string().default("Asia/Kolkata"),
  low_signal_threshold: z.number().int().min(1).default(5),
  unresolved_min_age_hours: z.number().min(0).default(48),
});
export type Settings = z.infer<typeof SettingsSchema>;

export async function loadSettings(): Promise<Settings> {
  const rows = await query<{ key: string; value: unknown }>(`SELECT key, value FROM settings`);
  const raw: Record<string, unknown> = {};
  for (const row of rows) raw[row.key] = row.value;
  const parsed = SettingsSchema.safeParse(raw);
  // If a stored value is malformed, fall back to defaults rather than breaking the weekly run.
  return parsed.success ? parsed.data : SettingsSchema.parse({});
}

export interface Config {
  topics: Topic[];
  keywords: Keyword[];
  objections: Objection[];
  settings: Settings;
}

/** Active config only: what the pipeline should use this week. */
export async function loadConfig(): Promise<Config> {
  const [topics, keywords, objections, settings] = await Promise.all([
    query<Topic>(`SELECT id, name, description, color, is_active, sort_order FROM topics WHERE is_active ORDER BY sort_order, id`),
    query<Keyword>(
      `SELECT k.id, k.topic_id, k.phrase, k.is_active
         FROM keywords k JOIN topics t ON t.id = k.topic_id
        WHERE k.is_active AND t.is_active
        ORDER BY k.topic_id, k.id`,
    ),
    query<Objection>(`SELECT id, label, description, is_active FROM sales_objections WHERE is_active ORDER BY id`),
    loadSettings(),
  ]);
  return { topics, keywords, objections, settings };
}

/** Everything, including inactive rows, for the Settings page. */
export async function loadAllConfig(): Promise<Config> {
  const [topics, keywords, objections, settings] = await Promise.all([
    query<Topic>(`SELECT id, name, description, color, is_active, sort_order FROM topics ORDER BY sort_order, id`),
    query<Keyword>(`SELECT id, topic_id, phrase, is_active FROM keywords WHERE is_active ORDER BY topic_id, id`),
    query<Objection>(`SELECT id, label, description, is_active FROM sales_objections ORDER BY id`),
    loadSettings(),
  ]);
  return { topics, keywords, objections, settings };
}

/**
 * Orders keywords round-robin across topics: topic A's 1st, topic B's 1st, ... then everyone's 2nd.
 * A rate-limited source (GitHub without a token) that only gets through part of the list
 * then still covers every topic evenly, instead of only the first few topics.
 */
export function interleaveByTopic(keywords: Pick<Keyword, "topic_id" | "phrase">[]): string[] {
  const byTopic = new Map<number, string[]>();
  for (const k of keywords) {
    if (!byTopic.has(k.topic_id)) byTopic.set(k.topic_id, []);
    byTopic.get(k.topic_id)!.push(k.phrase);
  }
  const lists = [...byTopic.values()];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  const out: string[] = [];
  for (let i = 0; i < longest; i++) for (const list of lists) if (i < list.length) out.push(list[i]);
  return out;
}
