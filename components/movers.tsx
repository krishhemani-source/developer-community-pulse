// Section 2: what moved week over week. Rising and falling side by side, then the rest.
import Link from "next/link";
import { TREND_TEXT, type TopicBrief, formatDelta, streakText } from "@/lib/brief";
import { cn } from "@/lib/utils";
import { Sparkline } from "./sparkline";
import { TONE_STROKE, TONE_TEXT, TrendIcon, trendTone } from "./trend";

export function Movers({ topics, threshold }: { topics: TopicBrief[]; threshold: number }) {
  if (topics.every((t) => t.previousCount === null)) {
    return <p className="text-sm text-muted">This is the first stored week, so there is nothing to compare yet. Build 4-week history to see movement.</p>;
  }
  const rising = topics.filter((t) => t.trend === "rising" || t.trend === "new").sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0));
  const falling = topics.filter((t) => t.trend === "falling").sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0));
  const rest = topics.filter((t) => !rising.includes(t) && !falling.includes(t));

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-8 md:grid-cols-2">
        <MoverColumn title="Rising" tone="rising" topics={rising} empty="No topic rose by at least 25% and 3 mentions." />
        <MoverColumn title="Falling" tone="falling" topics={falling} empty="No topic fell by at least 25% and 3 mentions." />
      </div>
      {rest.length > 0 && (
        <div>
          <h3 className="text-sm font-medium">Steady or too small to call</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {rest.map((t) => (
              <li key={t.id}>
                <Link href={`/topics/${t.id}`} className="tabular inline-flex items-baseline gap-2 rounded-md border border-rule bg-surface px-3 py-1.5 text-sm hover:border-ink/40">
                  {t.name}
                  <span className="text-muted">
                    {formatDelta(t.delta, t.pct)} · {TREND_TEXT[t.trend].toLowerCase()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            Rising or falling needs a 25% change and at least 3 mentions. Below {threshold} mentions in both weeks a topic is marked low signal, and percentages
            are hidden because small numbers exaggerate change.
          </p>
        </div>
      )}
    </div>
  );
}

function MoverColumn({ title, tone, topics, empty }: { title: string; tone: "rising" | "falling"; topics: TopicBrief[]; empty: string }) {
  return (
    <div>
      <h3 className={cn("flex items-center gap-1.5 text-sm font-semibold", TONE_TEXT[tone])}>
        <TrendIcon label={tone} />
        {title}
        <span className="tabular font-normal text-muted">({topics.length})</span>
      </h3>
      {topics.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-rule border-y border-rule">
          {topics.map((t) => {
            const streak = streakText(t.streak);
            return (
              <li key={t.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 py-3">
                <div className="min-w-0">
                  <Link href={`/topics/${t.id}`} className="font-medium hover:underline">
                    {t.name}
                  </Link>
                  <p className="tabular text-sm text-muted">
                    {t.previousCount ?? 0} → <span className="font-medium text-ink">{t.mentionCount}</span> mentions
                    {streak && <span className={cn("ml-2 font-medium", TONE_TEXT[tone])}>· {streak}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Sparkline series={t.series} stroke={TONE_STROKE[trendTone(t.trend)]} width={88} height={30} />
                  <span className={cn("tabular w-24 text-right text-lg font-semibold", TONE_TEXT[tone])}>{formatDelta(t.delta, t.pct)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
