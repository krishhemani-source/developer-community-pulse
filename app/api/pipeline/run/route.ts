// POST /api/pipeline/run: same as the "Run now" button (same cooldown and lock).
// Returns the run id immediately; poll /api/runs/{id} for progress.
import { NextResponse } from "next/server";
import { startManualRun } from "@/lib/pipeline/start";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST() {
  const result = await startManualRun();
  return NextResponse.json(result, { status: result.ok ? 202 : 409 });
}
