// "/" SignalForge dashboard: this week's Weekly Intelligence Brief.
import { BackfillButton } from "@/components/backfill-button";
import { BRAND, SignalMark } from "@/components/brand";
import { BriefView } from "@/components/brief-view";
import { RunControls } from "@/components/run-controls";
import { LoadError } from "@/components/states";
import { loadSettings } from "@/lib/config";
import { countBriefWeeks, getLatestBrief, getRun, load } from "@/lib/queries";
import { formatDateTime } from "@/lib/weeks";

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
      <div className="flex flex-col gap-10">
        <DashboardHeader />
        <section className="relative overflow-hidden rounded-2xl border border-rule bg-surface px-6 py-10 sm:px-10">
          <SignalMark size={140} className="pointer-events-none absolute -right-6 -top-6 text-ink opacity-[0.06]" />
          <p className="text-sm font-medium text-accent">{BRAND.brief}</p>
          <h2 className="mt-2 max-w-xl font-serif text-3xl leading-tight tracking-tight">No brief yet. Build 4-week history to get started.</h2>
          <p className="mt-3 max-w-2xl text-muted">
            SignalForge collects real posts from Hacker News, Stack Overflow, GitHub Issues and Dev.to for each of the last four weeks, one week at
            a time, so your first brief can already say whether a problem has been growing for a month.
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
  const meta = (
    <p className="tabular text-sm text-muted">
      {lastRun ? (
        <>
          Last run {formatDateTime(lastRun.started_at, settings.timezone)} · {lastRun.trigger} ·{" "}
          <span className={lastRun.status === "failed" ? "font-medium text-rising" : "text-ink"}>{STATUS_TEXT[lastRun.status]}</span>
          {" · "}
        </>
      ) : null}
      Email {brief.email_status.startsWith("failed") ? <span className="text-rising">{brief.email_status}</span> : brief.email_status.replace("_", " ")}
    </p>
  );

  return (
    <div className="flex flex-col gap-10">
      <DashboardHeader actions={<RunControls initialRun={runSummary} />} />

      {weeks < 4 && (
        <section className="flex flex-col gap-3 rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            Only {weeks} {weeks === 1 ? "week" : "weeks"} of history so far. Build four weeks so Emerging Signals and streaks mean something.
          </p>
          <BackfillButton variant="outline" />
        </section>
      )}

      <BriefView brief={b} markdown={brief.summary_markdown} meta={meta} />
    </div>
  );
}

/**
 * "SignalForge" with its descriptor and tagline; actions (Run now) on the right.
 * Deliberately compact: the brief's headline, not the product name, is the most prominent text on the page.
 */
function DashboardHeader({ actions }: { actions?: React.ReactNode }) {
  return (
    <header className="flex flex-col gap-4 border-b border-rule pb-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">{BRAND.name}</h1>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent-soft px-2.5 py-0.5 text-xs font-medium">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
            {BRAND.descriptor}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted">{BRAND.tagline}</p>
      </div>
      {actions}
    </header>
  );
}
