// "/runs" Run log: what every run did, how long each stage took, what each source returned,
// and how many AI statements verification removed.
import { ChevronRight } from "lucide-react";
import { SourceLabel } from "@/components/source-icon";
import { STAGE_LABELS } from "@/components/stage-progress";
import { LoadError, PageTitle } from "@/components/states";
import { SOURCES } from "@/lib/collectors/types";
import { loadSettings } from "@/lib/config";
import { type RunRow, listRuns, load } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/weeks";

export const dynamic = "force-dynamic";
export const metadata = { title: "Run log" };

const STATUS_STYLE: Record<RunRow["status"], string> = {
  running: "bg-ink text-paper",
  success: "border border-rule text-ink",
  partial: "border border-ink text-ink",
  failed: "border border-rising text-rising",
};
const STATUS_TEXT: Record<RunRow["status"], string> = { running: "Running", success: "Success", partial: "Partial", failed: "Failed" };

function seconds(ms: number) {
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
}

function duration(run: RunRow) {
  if (!run.finished_at) return "–";
  return seconds(new Date(run.finished_at).getTime() - new Date(run.started_at).getTime());
}

export default async function RunsPage() {
  const result = await load(async () => ({ runs: await listRuns(40), settings: await loadSettings() }));
  if (!result.ok) return <LoadError result={result} />;
  const { runs, settings } = result.data;

  return (
    <div>
      <PageTitle title="Run log">Every SignalForge collection run, newest first. Open a run to see stage timings, sources and verification.</PageTitle>
      {runs.length === 0 ? (
        <p className="text-muted">No runs yet. Start one from the Intelligence Brief with Run now or Build 4-week history.</p>
      ) : (
        <ul className="divide-y divide-rule border-y border-rule">
          {runs.map((run) => (
            <li key={run.id}>
              <details className="group">
                <summary className="grid grid-cols-[1rem_1fr_auto] items-center gap-3 py-3 sm:grid-cols-[1rem_4rem_7rem_1fr_6rem_auto]">
                  <ChevronRight aria-hidden="true" className="size-4 text-muted transition-transform group-open:rotate-90" />
                  <span className="tabular text-sm text-muted">#{run.id}</span>
                  <span className={cn("inline-flex w-fit rounded px-2 py-0.5 text-xs font-medium", STATUS_STYLE[run.status])}>{STATUS_TEXT[run.status]}</span>
                  <span className="tabular col-span-2 col-start-2 text-sm sm:col-span-1 sm:col-start-auto">
                    {formatDateTime(run.started_at, settings.timezone)} · {run.trigger}
                    {run.status === "running" && ` · ${run.stage}`}
                  </span>
                  <span className="tabular hidden text-sm text-muted sm:block">{duration(run)}</span>
                  <span className="tabular hidden text-sm text-muted sm:block">
                    {run.posts_fetched} fetched · {run.posts_relevant} relevant · {run.gemini_calls} Gemini calls
                  </span>
                </summary>
                <RunDetail run={run} timezone={settings.timezone} />
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RunDetail({ run, timezone }: { run: RunRow; timezone: string }) {
  const d = run.details ?? {};
  const v = d.verification;
  const tg = d.tagging;
  const removed = v ? v.itemsReceived - v.itemsKept : 0;
  return (
    <div className="grid gap-8 pb-6 pl-7 text-sm lg:grid-cols-3">
      <div className="space-y-4">
        <p className="tabular text-muted sm:hidden">
          {duration(run)} · {run.posts_fetched} fetched · {run.posts_relevant} relevant · {run.gemini_calls} Gemini calls
        </p>
        <p className="tabular text-muted">
          Window {formatDateTime(run.week_start, timezone)} to {formatDateTime(run.week_end, timezone)}
        </p>
        {run.error && (
          <p role="alert" className="border-l-2 border-rising pl-3">
            {run.error}
          </p>
        )}
        <div>
          <h3 className="mb-1 font-medium">Stage timing</h3>
          {d.stages && d.stages.length > 0 ? (
            <ul className="tabular space-y-0.5">
              {d.stages.map((s) => (
                <li key={s.stage} className="flex justify-between gap-4 border-b border-rule/60 py-0.5">
                  <span>{STAGE_LABELS.find((x) => x.key === s.stage)?.label ?? s.stage}</span>
                  <span className="text-muted">{seconds(s.ms)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">{run.status === "running" ? `Currently ${run.stage}.` : "No stage timing recorded."}</p>
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-1 font-medium">Sources</h3>
        <ul className="space-y-2">
          {SOURCES.map((s) => {
            const st = run.source_status?.[s];
            if (!st) return null;
            return (
              <li key={s}>
                <div className="flex items-center justify-between gap-3">
                  <SourceLabel source={s} className="text-ink" />
                  <span className={cn("tabular", st.ok ? "text-muted" : "font-medium text-rising")}>
                    {st.ok ? `${st.count} posts · ${st.requests} requests` : "Failed"}
                    {st.quotaRemaining !== null && st.quotaRemaining !== undefined && ` · quota ${st.quotaRemaining}`}
                  </span>
                </div>
                {st.error && <p className="mt-0.5 break-words text-xs">{st.error}</p>}
                {st.warnings?.slice(0, 3).map((w) => (
                  <p key={w} className="mt-0.5 break-words text-xs text-muted">
                    {w}
                  </p>
                ))}
              </li>
            );
          })}
        </ul>
        {(d.duplicates !== undefined || d.droppedByCap !== undefined) && (
          <p className="tabular mt-3 text-muted">
            {d.duplicates ?? 0} duplicates removed · {d.droppedByCap ?? 0} dropped by the 400-post cap
          </p>
        )}
      </div>

      <div className="space-y-4">
        {tg && (
          <div>
            <h3 className="mb-1 font-medium">Tagging (Gemini)</h3>
            <p className="tabular text-muted">
              {tg.batches} batches · {tg.failedBatches} failed · {tg.skippedBatches} skipped for time · {tg.irrelevant} irrelevant · {tg.lowConfidence}{" "}
              low confidence · {tg.untaggedPosts} untagged
            </p>
            {tg.log.slice(0, 4).map((l) => (
              <p key={l} className="mt-0.5 break-words text-xs text-muted">
                {l}
              </p>
            ))}
          </div>
        )}
        <div>
          <h3 className="mb-1 font-medium">Verification</h3>
          {v ? (
            <p className="tabular">
              {v.itemsKept} of {v.itemsReceived} AI statements kept; <span className="font-medium">{removed} removed</span>
              <span className="block text-muted">
                {v.itemsDroppedNoEvidence} without valid evidence · {v.itemsDroppedDigits} containing numbers · {v.itemsDroppedUnknownId} with unknown ids ·{" "}
                {v.evidenceIdsRemoved} invalid citations stripped{v.headlineReplaced ? (v.headlineUngrounded ? " · headline replaced by code (it did not name the week\u2019s key topic)" : " · headline replaced by code") : ""}
              </span>
            </p>
          ) : (
            <p className="text-muted">{d.aiError ? `Brief writing failed: ${d.aiError}` : "Not reached."}</p>
          )}
        </div>
        {d.email && (
          <div>
            <h3 className="mb-1 font-medium">Email</h3>
            <p className={d.email.startsWith("failed") ? "text-rising" : "text-muted"}>{d.email}</p>
          </div>
        )}
      </div>
    </div>
  );
}
