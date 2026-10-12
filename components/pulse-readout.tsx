// The pulse readout: one ruled row per topic, ranked by mentions.
// This is the one bold element on the page: big tabular counts, direction-coloured deltas
// and 4-week sparklines, read top to bottom like an instrument.
import Link from "next/link";
import { type TopicBrief, streakText } from "@/lib/brief";
import { cn } from "@/lib/utils";
import { ResolutionBar } from "./resolution-bar";
import { ResolutionLabel, SourceLabel } from "./source-icon";
import { Sparkline } from "./sparkline";
import { DeltaMark, TONE_STROKE, TONE_TEXT, trendTone } from "./trend";

export function PulseReadout({ topics }: { topics: TopicBrief[] }) {
  return (
    <div>
      <div aria-hidden="true" className="hidden grid-cols-[2rem_minmax(0,1fr)_5rem_8.5rem_7rem_9rem] gap-x-3 border-b border-rule pb-2 text-xs text-muted md:grid">
        <span>Rank</span>
        <span>Topic</span>
        <span>Mentions</span>
        <span>vs last week</span>
        <span>Last 4 weeks</span>
        <span>Resolution</span>
      </div>
      <ol className="divide-y divide-rule">
        {topics.map((t) => (
          <PulseRow key={t.id} topic={t} />
        ))}
      </ol>
    </div>
  );
}

function PulseRow({ topic: t }: { topic: TopicBrief }) {
  const tone = trendTone(t.trend);
  const streak = streakText(t.streak);
  const quiet = t.mentionCount === 0;

  return (
    <li className="-mx-3 rounded-lg px-3 py-4 transition-colors hover:bg-ink/[0.025]">
      <div className="grid grid-cols-[2rem_1fr_auto] items-start gap-x-3 gap-y-3 md:grid-cols-[2rem_minmax(0,1fr)_5rem_8.5rem_7rem_9rem] md:items-center">
        <span className="tabular pt-0.5 text-sm text-muted md:pt-0">{t.rank}</span>

        <div className="min-w-0">
          <Link href={`/topics/${t.id}`} className="font-medium hover:underline">
            {t.name}
          </Link>
          {streak && (
            <p className={cn("text-xs font-medium", TONE_TEXT[t.streak.direction === "falling" ? "falling" : "rising"])}>{streak}</p>
          )}
          {quiet && <p className="text-sm text-muted">No discussion this week</p>}
        </div>

        {/* Count: the confident number */}
        <div className="text-right md:text-left">
          <span className={cn("tabular text-3xl font-semibold leading-none tracking-tight", quiet && "text-muted")}>{t.mentionCount}</span>
          <span className="block text-xs text-muted">mentions</span>
        </div>

        <div className="col-span-3 col-start-2 flex flex-wrap items-center gap-x-6 gap-y-3 md:contents">
          <div>
            <DeltaMark label={t.trend} delta={t.delta} pct={t.pct} />
          </div>
          <div>
            <Sparkline series={t.series} stroke={TONE_STROKE[tone]} delay={(t.rank - 1) * 70} />
          </div>
          <div className="min-w-36 flex-1 md:min-w-0">
            {!quiet && <ResolutionBar resolution={t.resolution} share={t.unresolvedShare} />}
          </div>
        </div>
      </div>

      {!quiet && (t.insight || t.evidence.length > 0) && (
        <div className="mt-3 md:ml-[2.75rem] md:max-w-3xl">
          {t.insight && <p className="text-[15px] leading-relaxed">{t.insight}</p>}
          {t.evidence.length > 0 && (
            <details className="group mt-2">
              <summary className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
                <span className="group-open:hidden">Show {t.evidence.length} source threads</span>
                <span className="hidden group-open:inline">Hide source threads</span>
              </summary>
              <ul className="mt-2 space-y-2 border-l border-rule pl-3">
                {t.evidence.map((e) => (
                  <li key={e.postId} className="text-sm">
                    <a href={e.url} target="_blank" rel="noreferrer" className="hover:underline">
                      {e.title}
                    </a>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <SourceLabel source={e.source} />
                      <ResolutionLabel resolution={e.resolution} />
                      {e.painPoint && <span className="text-xs text-muted">“{e.painPoint}”</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </li>
  );
}
