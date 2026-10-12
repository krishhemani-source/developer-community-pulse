// Run protection for a public URL: one run at a time, and a cooldown on manual runs.
import { query, queryOne } from "../db";
import type { WeekWindow } from "../weeks";

export const COOLDOWN_MINUTES = 10;
/** A run can last at most 5 minutes on Vercel. Anything "running" for longer has died. */
export const STALE_MINUTES = 10;

export type Trigger = "cron" | "manual" | "backfill";

/** Marks runs that died mid-way (function killed, deploy, crash) as failed, which releases the lock. */
export async function releaseStaleRuns(): Promise<void> {
  await query(
    `UPDATE runs
        SET status = 'failed', finished_at = now(),
            error = COALESCE(error, 'Stopped before finishing at stage "' || stage || '" (time limit reached or the server restarted).')
      WHERE status = 'running' AND started_at < now() - ($1 || ' minutes')::interval`,
    [String(STALE_MINUTES)],
  );
}

/** Returns a clear refusal message, or null when a run may start. */
export async function refusalReason(trigger: Trigger): Promise<string | null> {
  await releaseStaleRuns();

  const running = await queryOne<{ minutes: number; trigger: string }>(
    `SELECT trigger, floor(extract(epoch FROM now() - started_at) / 60)::int AS minutes
       FROM runs WHERE status = 'running' LIMIT 1`,
  );
  if (running) {
    return `A ${running.trigger} run is already in progress (started ${running.minutes === 0 ? "less than a minute" : `${running.minutes} min`} ago). Wait for it to finish.`;
  }

  if (trigger === "manual") {
    const recent = await queryOne<{ minutes: number }>(
      `SELECT floor(extract(epoch FROM now() - started_at) / 60)::int AS minutes
         FROM runs WHERE trigger IN ('manual', 'cron')
        ORDER BY started_at DESC LIMIT 1`,
    );
    if (recent && recent.minutes < COOLDOWN_MINUTES) {
      const wait = COOLDOWN_MINUTES - recent.minutes;
      return `The last run started ${recent.minutes === 0 ? "less than a minute" : `${recent.minutes} min`} ago. To protect API quotas, try again in ${wait} min.`;
    }
  }
  return null;
}

/**
 * Creates the run row. Returns null if another run grabbed the lock first
 * (the unique index runs_one_running rejects a second 'running' row).
 */
export async function createRun(trigger: Trigger, window: WeekWindow): Promise<number | null> {
  try {
    const row = await queryOne<{ id: number }>(
      `INSERT INTO runs (trigger, week_start, week_end, status, stage)
       VALUES ($1, $2::timestamptz, $3::timestamptz, 'running', 'queued') RETURNING id`,
      [trigger, window.start.toISOString(), window.end.toISOString()],
    );
    return row?.id ?? null;
  } catch (err) {
    if (err instanceof Error && /runs_one_running|duplicate key/i.test(err.message)) return null;
    throw err;
  }
}
