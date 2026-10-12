// POST /api/pipeline/backfill: builds ONE missing week of history per request (oldest first),
// so every request stays inside Vercel's 300-second limit. The browser calls it repeatedly
// until { done: true }. It only ever fills the last 4 weeks, so it cannot be used to spam APIs.
import { NextResponse } from "next/server";
import { z } from "zod";
import { loadSettings } from "@/lib/config";
import { query } from "@/lib/db";
import { createRun, refusalReason } from "@/lib/pipeline/lock";
import { runPipeline } from "@/lib/pipeline/run";
import { backfillPlan } from "@/lib/weeks";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const BodySchema = z.object({ anchor: z.string().optional() });
const HISTORY_WEEKS = 4;

/** The anchor keeps all weeks of one backfill aligned. Accept the client's only if it is recent. */
function resolveAnchor(raw: string | undefined): Date {
  const now = Date.now();
  if (raw) {
    const t = Date.parse(raw);
    if (Number.isFinite(t) && t <= now && now - t < 3 * 60 * 60 * 1000) return new Date(t);
  }
  return new Date(now);
}

export async function POST(request: Request) {
  try {
    const body = BodySchema.safeParse(await request.json().catch(() => ({})));
    const anchor = resolveAnchor(body.success ? body.data.anchor : undefined);
    const settings = await loadSettings();

    const existing = await query<{ week_start: string }>(`SELECT week_start::text AS week_start FROM briefs`);
    const plan = backfillPlan(anchor, existing.map((r) => r.week_start), settings.timezone, HISTORY_WEEKS);
    if (plan.length === 0) {
      return NextResponse.json({ ok: true, done: true, planned: 0, remaining: 0, ranWeek: null, anchor: anchor.toISOString() });
    }

    const reason = await refusalReason("backfill");
    if (reason) return NextResponse.json({ ok: false, message: reason }, { status: 409 });

    const window = plan[0];
    const runId = await createRun("backfill", window);
    if (runId === null) {
      return NextResponse.json({ ok: false, message: "Another run started a moment ago. Wait for it to finish." }, { status: 409 });
    }
    const outcome = await runPipeline({ trigger: "backfill", window, runId, sendEmail: false });

    return NextResponse.json({
      ok: true,
      done: plan.length === 1 || outcome.status === "failed",
      planned: plan.length,
      remaining: plan.length - 1,
      ranWeek: window.weekStart,
      status: outcome.status,
      anchor: anchor.toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ ok: false, message: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
