// Called by Vercel Cron every Friday at 02:30 UTC (08:00 IST). See vercel.json.
// Vercel sends "Authorization: Bearer <CRON_SECRET>"; anything else is rejected.
import { NextResponse } from "next/server";
import { loadSettings } from "@/lib/config";
import { refusalReason } from "@/lib/pipeline/lock";
import { runPipeline } from "@/lib/pipeline/run";
import { windowEndingAt } from "@/lib/weeks";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, message: "CRON_SECRET is not set on the server." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const reason = await refusalReason("cron");
    if (reason) return NextResponse.json({ ok: false, message: reason }, { status: 409 });

    const settings = await loadSettings();
    const window = windowEndingAt(new Date(), settings.timezone);
    const outcome = await runPipeline({ trigger: "cron", window, sendEmail: true });
    return NextResponse.json({ ok: outcome.status !== "failed", ...outcome });
  } catch (err) {
    return NextResponse.json({ ok: false, message: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
