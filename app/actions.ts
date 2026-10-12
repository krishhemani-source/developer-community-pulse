"use server";
// Server action behind the "Run now" button.
import { type StartResult, startManualRun } from "@/lib/pipeline/start";

export async function runNowAction(): Promise<StartResult> {
  return startManualRun();
}
