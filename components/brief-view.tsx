// Renders a saved brief. Used by the main page and, read-only, by /history/[week].
import { CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import Link from "next/link";
import { type BriefContent, formatShare } from "@/lib/brief";
import { SOURCE_LABELS, SOURCES } from "@/lib/collectors/types";
import { CopyForDocButton } from "./copy-button";
import { OpportunityQuadrant, type QuadrantPoint } from "./opportunity-quadrant";
import { PulseReadout } from "./pulse-readout";
import { SourceLabel } from "./source-icon";
import { trendTone } from "./trend";

export function BriefView({ brief, markdown }: { brief: BriefContent; markdown: string }) {
  const points: QuadrantPoint[] = brief.topics
    .filter((t) => t.mentionCount > 0 && t.unresolvedShare !== null)
    .map((t) => ({
      id: t.id,
      rank: t.rank,
      name: t.name,
      mentions: t.mentionCount,
      share: Math.round((t.unresolvedShare ?? 0) * 100),
      engagement: t.engagement,
      tone: trendTone(t.trend),
    }));
  const topicName = (id: number) => brief.topics.find((t) => t.id === id)?.name ?? "Topic";

  return (
    <div className="flex flex-col gap-14">
      {/* The headline: the most prominent text on the page. */}
      <section aria-label="Headline">
        <p className="max-w-4xl font-serif text-[1.65rem] leading-snug tracking-tight text-balance sm:text-[2rem]">{brief.headline}</p>
        {brief.notes.length > 0 && (
          <ul className="mt-4 space-y-1 text-sm text-muted">
            {brief.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
      </section>

      <PulseReadout topics={brief.topics} />

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <section aria-labelledby="quadrant-heading">
          <h2 id="quadrant-heading" className="border-b border-ink pb-2 text-lg font-semibold">
            Opportunity quadrant
          </h2>
          <p className="mb-3 mt-2 text-sm text-muted">How often a problem comes up, against how often it stays unresolved. Select a bubble to open the topic.</p>
          <OpportunityQuadrant points={points} />
          {brief.underserved.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold">Underserved: frequent and mostly unresolved</h3>
              <ul className="mt-2 divide-y divide-rule">
                {brief.underserved.map((u) => {
                  const t = brief.topics.find((x) => x.id === u.topicId);
                  return (
                    <li key={u.topicId} className="py-3 text-sm">
                      <Link href={`/topics/${u.topicId}`} className="font-medium hover:underline">
                        {topicName(u.topicId)}
                      </Link>
                      <span className="tabular text-muted"> · {formatShare(t?.unresolvedShare ?? null)} unresolved</span>
                      <p className="mt-1">{u.whyUnresolved}</p>
                      {u.evidence[0] && (
                        <a href={u.evidence[0].url} target="_blank" rel="noreferrer" className="mt-1 block text-muted hover:text-ink hover:underline">
                          {u.evidence[0].title}
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>

        <section aria-labelledby="objections-heading">
          <h2 id="objections-heading" className="border-b border-ink pb-2 text-lg font-semibold">
            Sales objection signals
          </h2>
          <p className="mb-3 mt-2 text-sm text-muted">Public posts that echo what your sales team hears in demos.</p>
          <ul className="divide-y divide-rule">
            {brief.objections.map((o) => (
              <li key={o.objectionId} className="py-3">
                <div className="flex items-baseline justify-between gap-4">
                  <span className={o.count === 0 ? "text-muted" : "font-medium"}>{o.label}</span>
                  <span className="tabular shrink-0 text-xl font-semibold">
                    {o.count}
                    <span className="sr-only"> posts</span>
                  </span>
                </div>
                {o.whatDevelopersSay && <p className="mt-1 text-sm">{o.whatDevelopersSay}</p>}
                {o.posts.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {o.posts.slice(0, 3).map((p) => (
                      <li key={p.postId} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                        <a href={p.url} target="_blank" rel="noreferrer" className="text-muted hover:text-ink hover:underline">
                          {p.title}
                        </a>
                        <SourceLabel source={p.source} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section aria-labelledby="talking-heading">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink pb-2">
          <h2 id="talking-heading" className="text-lg font-semibold">
            Monday talking points
          </h2>
          <CopyForDocButton markdown={markdown} />
        </div>
        {brief.talkingPoints.length > 0 ? (
          <ol className="mt-4 grid gap-6 md:grid-cols-3">
            {brief.talkingPoints.map((p, i) => (
              <li key={i} className="flex gap-3">
                <span className="tabular font-serif text-2xl leading-none text-muted">{i + 1}</span>
                <p className="leading-relaxed">{p}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-4 text-sm text-muted">No talking points this week. The AI summary was unavailable or did not pass verification.</p>
        )}
      </section>

      <section aria-labelledby="sources-heading" className="flex flex-col gap-3 border-t border-rule pt-5 text-sm">
        <h2 id="sources-heading" className="sr-only">
          Source health
        </h2>
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          {SOURCES.map((s) => {
            const st = brief.sources[s];
            if (!st) return null;
            return (
              <li key={s} className="flex items-center gap-1.5" title={st.error ?? undefined}>
                {st.ok ? (
                  <CheckCircle2 aria-hidden="true" className="size-4 text-muted" />
                ) : (
                  <XCircle aria-hidden="true" className="size-4 text-rising" />
                )}
                <SourceLabel source={s} className="text-ink" />
                <span className="tabular text-muted">{st.ok ? `${st.count} posts` : "failed"}</span>
                <span className="sr-only">{st.ok ? "OK" : `Failed: ${st.error}`}</span>
              </li>
            );
          })}
        </ul>
        <p className="flex flex-wrap items-center gap-x-2 text-muted">
          <ShieldCheck aria-hidden="true" className="size-4" />
          <span className="tabular">
            {brief.totals.fetched} posts collected, {brief.totals.relevant} relevant after AI filtering.
            {brief.verification
              ? ` ${brief.verification.itemsKept} of ${brief.verification.itemsReceived} AI statements passed verification; ${brief.verification.itemsReceived - brief.verification.itemsKept} removed.`
              : ""}{" "}
            Counts are computed in code; every claim links to a source thread.
          </span>
        </p>
        {SOURCES.some((s) => brief.sources[s] && !brief.sources[s].ok) && (
          <p className="text-muted">
            Failed sources: {SOURCES.filter((s) => brief.sources[s] && !brief.sources[s].ok).map((s) => SOURCE_LABELS[s]).join(", ")}. Details are in the{" "}
            <Link href="/runs" className="underline">
              run log
            </Link>
            .
          </p>
        )}
      </section>
    </div>
  );
}
