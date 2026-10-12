// Starting runs from the web app. Shared by the "Run now" server action and /api/pipeline/run.
import { after } from "next/server";
import { loadSettings } from "../config";
import { ConfigError } from "../db";
import { windowEndingAt } from "../weeks";
import { createRun, refusalReason } from "./lock";
import { runPipeline } from "./run";

export type StartResult = { ok: true; runId: number } | { ok: false; message: string };

/**
 * Creates the run row, returns its id straight away, and runs the pipeline after the response
 * is sent (Next.js `after`), so the browser can poll progress while it works.
 */
export async function startManualRun(): Promise<StartResult> {
  try {
    const reason = await refusalReason("manual");
    if (reason) return { ok: false, message: reason };

    const settings = await loadSettings();
    const window = windowEndingAt(new Date(), settings.timezone);
    const runId = await createRun("manual", window);
    if (runId === null) return { ok: false, message: "Another run started a moment ago. Wait for it to finish." };

    after(async () => {
      await runPipeline({ trigger: "manual", window, runId, sendEmail: true });
    });
    return { ok: true, runId };
  } catch (err) {
    if (err instanceof ConfigError) return { ok: false, message: err.message };
    return { ok: false, message: `Could not start the run: ${err instanceof Error ? err.message : String(err)}` };
  }
}
