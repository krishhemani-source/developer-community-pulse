"use server";
// Settings server actions. Every change: (1) checks the passcode cookie if one is configured,
// (2) validates input with zod, (3) writes the change, (4) records before/after in config_changes.
// Nothing is hard-deleted: topics, keywords and objections are deactivated so history stays intact.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canEdit, lock, unlock } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";

export type ActionResult = { ok: boolean; message: string };

async function guard(): Promise<ActionResult | null> {
  if (!(await canEdit())) return { ok: false, message: "Enter the admin passcode to edit settings." };
  return null;
}

async function audit(entity: string, entityId: string | number, action: string, before: unknown, after: unknown) {
  await query(`INSERT INTO config_changes (entity, entity_id, action, before, after) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)`, [
    entity,
    String(entityId),
    action,
    before === null ? null : JSON.stringify(before),
    after === null ? null : JSON.stringify(after),
  ]);
}

function done(message: string): ActionResult {
  revalidatePath("/settings");
  revalidatePath("/");
  return { ok: true, message };
}

function failure(err: unknown): ActionResult {
  return { ok: false, message: `Save failed: ${err instanceof Error ? err.message : String(err)}` };
}

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input.";
}

// ---------- Passcode ----------

export async function unlockAction(passcode: string): Promise<ActionResult> {
  const ok = await unlock(passcode);
  if (!ok) return { ok: false, message: "That passcode is not correct." };
  revalidatePath("/settings");
  return { ok: true, message: "Unlocked. You can edit settings now." };
}

export async function lockAction(): Promise<ActionResult> {
  await lock();
  revalidatePath("/settings");
  return { ok: true, message: "Locked. Settings are read-only again." };
}

// ---------- Topics ----------

const TopicInput = z.object({
  name: z.string().trim().min(1, "Topic name cannot be empty.").max(80, "Keep the topic name under 80 characters."),
  description: z.string().trim().max(300, "Keep the description under 300 characters."),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colour must be a hex value like #1D4ED8."),
});

async function topicNameTaken(name: string, exceptId: number | null): Promise<boolean> {
  const row = await queryOne<{ id: number }>(`SELECT id FROM topics WHERE lower(name) = lower($1) AND ($2::int IS NULL OR id <> $2)`, [
    name,
    exceptId,
  ]);
  return row !== null;
}

export async function createTopicAction(input: z.input<typeof TopicInput>): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const parsed = TopicInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  try {
    if (await topicNameTaken(parsed.data.name, null)) return { ok: false, message: `A topic called "${parsed.data.name}" already exists.` };
    const row = await queryOne<{ id: number }>(
      `INSERT INTO topics (name, description, color, sort_order)
       VALUES ($1, $2, $3, (SELECT COALESCE(max(sort_order), 0) + 1 FROM topics)) RETURNING id`,
      [parsed.data.name, parsed.data.description, parsed.data.color],
    );
    await audit("topic", row!.id, "create", null, parsed.data);
    return done(`Added topic "${parsed.data.name}". Add keywords so it collects posts.`);
  } catch (err) {
    return failure(err);
  }
}

export async function updateTopicAction(id: number, input: z.input<typeof TopicInput>): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const parsed = TopicInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  try {
    const before = await queryOne<{ name: string; description: string; color: string }>(`SELECT name, description, color FROM topics WHERE id = $1`, [id]);
    if (!before) return { ok: false, message: "That topic no longer exists. Reload the page." };
    if (await topicNameTaken(parsed.data.name, id)) return { ok: false, message: `A topic called "${parsed.data.name}" already exists.` };
    await query(`UPDATE topics SET name = $2, description = $3, color = $4, updated_at = now() WHERE id = $1`, [
      id,
      parsed.data.name,
      parsed.data.description,
      parsed.data.color,
    ]);
    await audit("topic", id, "update", before, parsed.data);
    return done(`Saved changes to "${parsed.data.name}".`);
  } catch (err) {
    return failure(err);
  }
}

export async function setTopicActiveAction(id: number, active: boolean): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  try {
    const row = await queryOne<{ name: string }>(`UPDATE topics SET is_active = $2, updated_at = now() WHERE id = $1 RETURNING name`, [id, active]);
    if (!row) return { ok: false, message: "That topic no longer exists. Reload the page." };
    await audit("topic", id, active ? "activate" : "deactivate", { is_active: !active }, { is_active: active });
    return done(active ? `Activated "${row.name}".` : `Deactivated "${row.name}". Its history is kept.`);
  } catch (err) {
    return failure(err);
  }
}

export async function moveTopicAction(id: number, direction: "up" | "down"): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  try {
    const topics = await query<{ id: number; name: string }>(`SELECT id, name FROM topics ORDER BY sort_order, id`);
    const index = topics.findIndex((t) => t.id === id);
    const target = direction === "up" ? index - 1 : index + 1;
    if (index === -1 || target < 0 || target >= topics.length) return { ok: false, message: "That topic cannot move further." };
    const before = topics.map((t) => t.id);
    [topics[index], topics[target]] = [topics[target], topics[index]];
    for (const [i, t] of topics.entries()) {
      await query(`UPDATE topics SET sort_order = $2 WHERE id = $1`, [t.id, i + 1]);
    }
    await audit("topic", id, "reorder", { order: before }, { order: topics.map((t) => t.id) });
    return done(`Moved "${topics[target].name}" ${direction}.`);
  } catch (err) {
    return failure(err);
  }
}

// ---------- Keywords ----------

const PhraseInput = z
  .string()
  .trim()
  .min(2, "Keyword must be at least 2 characters.")
  .max(60, "Keep keywords under 60 characters.")
  .refine((s) => !/["\\]/.test(s), "Keywords cannot contain quotes or backslashes.");

export async function addKeywordAction(topicId: number, phrase: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const parsed = PhraseInput.safeParse(phrase);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  try {
    const dup = await queryOne<{ topic: string }>(
      `SELECT t.name AS topic FROM keywords k JOIN topics t ON t.id = k.topic_id WHERE k.is_active AND lower(k.phrase) = lower($1)`,
      [parsed.data],
    );
    if (dup) return { ok: false, message: `"${parsed.data}" is already a keyword under "${dup.topic}".` };
    const row = await queryOne<{ id: number }>(`INSERT INTO keywords (topic_id, phrase) VALUES ($1, $2) RETURNING id`, [topicId, parsed.data]);
    await audit("keyword", row!.id, "create", null, { topic_id: topicId, phrase: parsed.data });
    return done(`Added keyword "${parsed.data}". It is used from the next run.`);
  } catch (err) {
    return failure(err);
  }
}

export async function removeKeywordAction(keywordId: number): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  try {
    const row = await queryOne<{ phrase: string; topic_id: number }>(
      `UPDATE keywords SET is_active = FALSE WHERE id = $1 RETURNING phrase, topic_id`,
      [keywordId],
    );
    if (!row) return { ok: false, message: "That keyword no longer exists. Reload the page." };
    await audit("keyword", keywordId, "deactivate", { phrase: row.phrase, topic_id: row.topic_id, is_active: true }, { is_active: false });
    return done(`Removed keyword "${row.phrase}".`);
  } catch (err) {
    return failure(err);
  }
}

// ---------- Sales objections ----------

const ObjectionInput = z.object({
  label: z.string().trim().min(1, "Objection cannot be empty.").max(140, "Keep the objection under 140 characters."),
  description: z.string().trim().max(300, "Keep the description under 300 characters."),
});

export async function createObjectionAction(input: z.input<typeof ObjectionInput>): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const parsed = ObjectionInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  try {
    const dup = await queryOne<{ id: number }>(`SELECT id FROM sales_objections WHERE lower(label) = lower($1)`, [parsed.data.label]);
    if (dup) return { ok: false, message: "That objection already exists." };
    const row = await queryOne<{ id: number }>(`INSERT INTO sales_objections (label, description) VALUES ($1, $2) RETURNING id`, [
      parsed.data.label,
      parsed.data.description,
    ]);
    await audit("objection", row!.id, "create", null, parsed.data);
    return done("Added objection. Posts are matched to it from the next run.");
  } catch (err) {
    return failure(err);
  }
}

export async function updateObjectionAction(id: number, input: z.input<typeof ObjectionInput>): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const parsed = ObjectionInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  try {
    const before = await queryOne<{ label: string; description: string }>(`SELECT label, description FROM sales_objections WHERE id = $1`, [id]);
    if (!before) return { ok: false, message: "That objection no longer exists. Reload the page." };
    await query(`UPDATE sales_objections SET label = $2, description = $3 WHERE id = $1`, [id, parsed.data.label, parsed.data.description]);
    await audit("objection", id, "update", before, parsed.data);
    return done("Saved objection.");
  } catch (err) {
    return failure(err);
  }
}

export async function setObjectionActiveAction(id: number, active: boolean): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  try {
    const row = await queryOne<{ label: string }>(`UPDATE sales_objections SET is_active = $2 WHERE id = $1 RETURNING label`, [id, active]);
    if (!row) return { ok: false, message: "That objection no longer exists. Reload the page." };
    await audit("objection", id, active ? "activate" : "deactivate", { is_active: !active }, { is_active: active });
    return done(active ? "Activated objection." : "Deactivated objection. Its history is kept.");
  } catch (err) {
    return failure(err);
  }
}

// ---------- General settings ----------

const GeneralInput = z.object({
  recipient_email: z.union([z.literal(""), z.string().trim().email("Enter a valid email address, or leave it empty.")]),
  devto_tags: z
    .array(z.string().trim().toLowerCase().regex(/^[a-z0-9]+$/, "Dev.to tags are lowercase letters and numbers only, like githubactions."))
    .min(1, "Keep at least one Dev.to tag.")
    .max(12, "Use at most 12 Dev.to tags."),
});

export async function saveGeneralSettingsAction(input: z.input<typeof GeneralInput>): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const parsed = GeneralInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  const tags = [...new Set(parsed.data.devto_tags)];
  try {
    for (const [key, value] of [
      ["recipient_email", parsed.data.recipient_email.trim()],
      ["devto_tags", tags],
    ] as const) {
      const before = await queryOne<{ value: unknown }>(`SELECT value FROM settings WHERE key = $1`, [key]);
      if (JSON.stringify(before?.value ?? null) === JSON.stringify(value)) continue;
      await query(`INSERT INTO settings (key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [
        key,
        JSON.stringify(value),
      ]);
      await audit("setting", key, "update", { value: before?.value ?? null }, { value });
    }
    return done("Saved changes.");
  } catch (err) {
    return failure(err);
  }
}
