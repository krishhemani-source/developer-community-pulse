// GET /api/runs/{id} or /api/runs/latest: run status for progress polling.
import { NextResponse } from "next/server";
import { getRun } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const key = id === "latest" ? "latest" : Number(id);
  if (key !== "latest" && !Number.isInteger(key)) {
    return NextResponse.json({ message: "Run id must be a number or 'latest'." }, { status: 400 });
  }
  try {
    const run = await getRun(key);
    if (!run) return NextResponse.json({ message: "Run not found." }, { status: 404 });
    return NextResponse.json({
      id: run.id,
      status: run.status,
      stage: run.stage,
      trigger: run.trigger,
      error: run.error,
      startedAt: run.started_at,
      finishedAt: run.finished_at,
    });
  } catch (err) {
    return NextResponse.json({ message: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
