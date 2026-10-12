// "/" This week's brief: the main screen.
import { BackfillButton } from "@/components/backfill-button";
import { BriefView } from "@/components/brief-view";
import { RunControls } from "@/components/run-controls";
import { LoadError } from "@/components/states";
import { loadSettings } from "@/lib/config";
import { countBriefWeeks, getLatestBrief, getRun, load } from "@/lib/queries";
import { formatDateTime, formatWeekRange } from "@/lib/weeks";

export const dynamic = "force-dynamic";
// The "Run now" server action runs the pipeline after responding; give it Vercel's full 300 seconds.
export const maxDuration = 300;

const STATUS_TEXT = { running: "Running", success: "Success", partial: "Partial", failed: "Failed" } as const;

export default async function BriefPage() {
  const result = await load(async () => {
    const [brief, lastRun, weeks, settings] = await Promise.all([getLatestBrief(), getRun("latest"), countBriefWeeks(), loadSettings()]);
    return { brief, lastRun, weeks, settings };
  });
  if (!result.ok) return <LoadError result={result} />;
  const { brief, lastRun, weeks, settings } = result.data;

  const runSummary = lastRun
    ? { id: lastRun.id, status: lastRun.status, stage: lastRun.stage, trigger: lastRun.trigger, error: lastRun.error }
    : null;

  if (!brief) {
    return (
      <div className="flex flex-col gap-8">
        <section className="max-w-2xl">
          <h1 className="font-serif text-3xl leading-tight tracking-tight">No brief yet. Build 4-week history to get started.</h1>
          <p className="mt-3 text-muted">
            This collects real posts from Hacker News, Stack Overflow, GitHub Issues and Dev.to for each of the last four weeks, one week at a
            time, so the first brief can already say whether a problem has been growing for a month.
          </p>
          <div className="mt-6">
            <BackfillButton />
          </div>
        </section>
        {lastRun?.status === "failed" && (
          <p className="text-sm text-muted">
            Last run failed: <span className="text-ink">{lastRun.error}</span>
          </p>
        )}
      </div>
    );
  }

  const b = brief.content;
  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col justify-between gap-4 border-b border-rule pb-6 sm:flex-row sm:items-start">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-muted">Weekly developer community brief</p>
          <h1 className="tabular mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">{formatWeekRange(b.weekStart, b.weekEnd)}</h1>
          <p className="mt-2 text-[15px] text-muted">
            What developers on Hacker News, Stack Overflow, GitHub and Dev.to struggled with, how it is trending, and what is still unsolved.
          </p>
          {lastRun && (
            <p className="tabular mt-1 text-sm text-muted">
              Last run {formatDateTime(lastRun.started_at, settings.timezone)} · {lastRun.trigger} ·{" "}
              <span className={lastRun.status === "failed" ? "font-medium text-rising" : "text-ink"}>{STATUS_TEXT[lastRun.status]}</span>
              {" · "}Email {brief.email_status.startsWith("failed") ? <span className="text-rising">{brief.email_status}</span> : brief.email_status.replace("_", " ")}
            </p>
          )}
        </div>
        <RunControls initialRun={runSummary} />
      </header>

      {weeks < 4 && (
        <section className="flex flex-col gap-3 border-l-2 border-ink pl-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            Only {weeks} {weeks === 1 ? "week" : "weeks"} of history so far. Build four weeks so trends and streaks mean something.
          </p>
          <BackfillButton variant="outline" />
        </section>
      )}

      <BriefView brief={b} markdown={brief.summary_markdown} />
    </div>
  );
}
