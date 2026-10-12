// Database access. One tiny wrapper around Neon's serverless driver.
// Every query in the app is plain parameterised SQL ($1, $2 ...), so values are never
// pasted into SQL strings and every query can be read and explained as-is.
import { neon } from "@neondatabase/serverless";

type NeonClient = ReturnType<typeof neon>;

let client: NeonClient | null = null;

/** Thrown when the app is not configured yet, so pages can show a helpful setup message. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

function getClient(): NeonClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new ConfigError(
      "DATABASE_URL is not set. Copy .env.example to .env.local, paste your Neon connection string, then run npm run db:migrate and npm run db:seed.",
    );
  }
  if (!client) client = neon(url);
  return client;
}

/** True for network-level failures (DNS blip, dropped connection) where the request never got an answer. */
function isConnectionError(err: unknown): boolean {
  return err instanceof Error && /Error connecting to database|fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND/i.test(err.message);
}

/** Run a parameterised query and return all rows. Connection blips are retried twice. */
export async function query<T>(text: string, params: unknown[] = []): Promise<T[]> {
  for (let attempt = 1; ; attempt++) {
    try {
      const rows = await getClient().query(text, params);
      return rows as unknown as T[];
    } catch (err) {
      if (attempt >= 3 || !isConnectionError(err)) throw err;
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}

/** Run a parameterised query and return the first row, or null. */
export async function queryOne<T>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** True when the error means "tables do not exist yet" (migrations not run). */
export function isMissingTableError(err: unknown): boolean {
  return err instanceof Error && /relation .* does not exist/i.test(err.message);
}

/** Converts a database timestamp (Date or string) to an ISO string. */
export function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}
