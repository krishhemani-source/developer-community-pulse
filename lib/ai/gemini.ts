// The only place the app talks to Gemini. Server-side only: the API key is read from
// process.env here and never reaches the browser.
import { GoogleGenAI, type Schema } from "@google/genai";
import type { z } from "zod";

export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
/** Other Flash models (comma-separated) tried in turn when the primary is overloaded (503) or out of quota (429). */
export const DEFAULT_GEMINI_FALLBACK_MODELS = "gemini-3.6-flash,gemini-3.5-flash-lite";

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set. Create a key at https://aistudio.google.com/apikey and add it to .env.local.");
  if (!client) client = new GoogleGenAI({ apiKey });
  return client;
}

export function geminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

function geminiModels(): string[] {
  const fallbacks = (process.env.GEMINI_FALLBACK_MODEL?.trim() || DEFAULT_GEMINI_FALLBACK_MODELS)
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return [...new Set([geminiModel(), ...fallbacks])];
}

/** Counts every Gemini request in a run, for the run log. */
export interface GeminiCounter {
  calls: number;
}

/** Raised when Gemini's output still fails validation after the retry. */
export class GeminiOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiOutputError";
  }
}

interface GenerateJsonOptions<T> {
  system: string;
  prompt: string;
  responseSchema: Schema;
  validator: z.ZodType<T>;
  counter: GeminiCounter;
  /** Epoch ms after which no new attempt starts and no request may still be running. */
  deadline: number;
}

/** Below this much time left, a new Gemini attempt is not worth starting. */
const MIN_ATTEMPT_MS = 8_000;
/** Longest a single Gemini request may take. */
const REQUEST_TIMEOUT_MS = 60_000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** HTTP status of a Gemini API error, if any (429 = rate limit, 503 = overloaded). */
function statusOf(err: unknown): number | null {
  const status = (err as { status?: unknown })?.status;
  if (typeof status === "number") return status;
  const match = err instanceof Error ? err.message.match(/"code":\s*(\d{3})/) : null;
  return match ? Number(match[1]) : null;
}

/** How long Google asks us to wait after a 429, capped at 30 seconds. */
function retryDelayMs(err: unknown): number {
  const match = err instanceof Error ? err.message.match(/retryDelay"?:\s*"?(\d+(?:\.\d+)?)s/) : null;
  return Math.min(30_000, match ? Math.ceil(Number(match[1]) * 1000) : 8_000);
}

/** Up to 5 attempts for capacity errors (429/503); broken JSON is retried once, as specified. */
const MAX_ATTEMPTS = 5;

/**
 * Asks Gemini for JSON matching `responseSchema`, then validates it with zod.
 * - Invalid JSON or a schema mismatch: retried once.
 * - Rate limit (429) or overload (503): waits, moves to the next Flash model, and retries.
 * If it still fails it throws, and the caller decides what to skip.
 */
export async function generateJson<T>(opts: GenerateJsonOptions<T>): Promise<T> {
  const models = geminiModels();
  let modelIndex = 0;
  let badOutputs = 0;
  let lastError = "unknown error";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const model = models[modelIndex % models.length];
    const remaining = opts.deadline - Date.now();
    if (remaining < MIN_ATTEMPT_MS) {
      lastError = `run time budget reached (${lastError})`;
      break;
    }
    try {
      opts.counter.calls++;
      const response = await getClient().models.generateContent({
        model,
        contents: opts.prompt,
        config: {
          systemInstruction: opts.system,
          responseMimeType: "application/json",
          responseSchema: opts.responseSchema,
          temperature: 0.2,
          // Our own loop does the retrying; the SDK's built-in retries are switched off so
          // the total time stays predictable inside Vercel's 300-second limit.
          httpOptions: { timeout: Math.min(REQUEST_TIMEOUT_MS, remaining), retryOptions: { attempts: 1 } },
        },
      });
      const text = response.text;
      if (!text) throw new Error("Empty response");
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        json = undefined;
      }
      const parsed = opts.validator.safeParse(json);
      if (parsed.success) return parsed.data;
      lastError = json === undefined ? "invalid JSON" : `schema mismatch: ${parsed.error.issues[0]?.path.join(".")} ${parsed.error.issues[0]?.message}`;
      if (++badOutputs >= 2) break; // spec: one retry for broken output
    } catch (err) {
      lastError = `${model}: ${err instanceof Error ? err.message : String(err)}`;
      const status = statusOf(err);
      if (status === 429 || status === 503 || status === 500) {
        modelIndex++; // try the next Flash model
        const wait = status === 429 ? retryDelayMs(err) : 2_000 * attempt;
        if (Date.now() + wait + MIN_ATTEMPT_MS > opts.deadline) break; // no time left to wait and retry
        await sleep(wait);
        continue;
      }
      if (++badOutputs >= 2) break;
    }
  }
  throw new GeminiOutputError(`Gemini output rejected after retry: ${lastError.slice(0, 300)}`);
}
