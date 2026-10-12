// Renders a saved brief, organised around Sumit's three questions.
// Used by the main page and, read-only, by /history/[week].
import { CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import Link from "next/link";
import { type BriefContent, formatShare } from "@/lib/brief";
import { SOURCES } from "@/lib/collectors/types";
import { BriefHero } from "./brief-hero";
import { CopyForDocButton } from "./copy-button";
import { Movers } from "./movers";
import { OpportunityQuadrant, type QuadrantPoint } from "./opportunity-quadrant";
import { PulseReadout } from "./pulse-readout";
import { BriefSection } from "./section";
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
  const withSignals = brief.objections.filter((o) => o.count > 0);
  const withoutSignals = brief.objections.filter((o) => o.count === 0);

  return (
    <div className="flex flex-col gap-16">
      <BriefHero brief={brief} />

      {brief.notes.length > 0 && (
        <aside aria-label="Notes about this week's data" className="-mt-8 border-l-2 border-rule pl-4 text-sm text-muted">
          <ul className="space-y-1">
            {brief.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </aside>
      )}

      <BriefSection
        id="surfacing"
        number={1}
        question="What pain points are surfacing most?"
        lead="Topics ranked by how many relevant posts mentioned them this week. Open a row's source threads to read what developers actually wrote."
      >
        <PulseReadout topics={brief.topics} />
      </BriefSection>

      <BriefSection
        id="moving"
        number={2}
        question="What is moving week over week?"
        lead="Change against last week's count, with the last four weeks drawn beside it. A streak means it has moved the same way several weeks running."
      >
        <Movers topics={brief.topics} threshold={brief.lowSignalThreshold} />
      </BriefSection>

      <BriefSection
        id="unsolved"
        number={3}
        question="Which problems are still unsolved?"
        lead="How often a problem comes up against how often it stays unresolved. Top right is the opportunity: frequent and still open. Select a bubble to open the topic."
      >
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <OpportunityQuadrant points={points} />
          <div>
            <h3 className="text-sm font-semibold">Underserved this week</h3>
            {brief.underserved.length > 0 ? (
              <ul className="mt-2 divide-y divide-rule border-y border-rule">
                {brief.underserved.map((u) => {
                  const t = brief.topics.find((x) => x.id === u.topicId);
                  return (
                    <li key={u.topicId} className="py-3 text-sm">
                      <div className="flex items-baseline justify-between gap-3">
                        <Link href={`/topics/${u.topicId}`} className="font-medium hover:underline">
                          {topicName(u.topicId)}
                        </Link>
                        <span className="tabular shrink-0 text-muted">
                          <span className="font-semibold text-ink">{formatShare(t?.unresolvedShare ?? null)}</span> unresolved
                        </span>
                      </div>
                      <p className="mt-1">{u.whyUnresolved}</p>
                      {u.evidence.slice(0, 2).map((e) => (
                        <a key={e.postId} href={e.url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-muted hover:text-ink hover:underline">
                          {e.title}
                        </a>
                      ))}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">No topic was both frequent and mostly unresolved this week, or the AI summary was unavailable.</p>
            )}
          </div>
        </div>
      </BriefSection>

      <BriefSection
        id="sales"
        number={4}
        question="What sales hears, developers are saying"
        lead="The objections your sales team keeps hearing in demos, matched against public posts that echo them."
      >
        {withSignals.length > 0 ? (
          <ul className="grid gap-x-10 gap-y-6 md:grid-cols-2">
            {withSignals.map((o) => (
              <li key={o.objectionId} className="border-t border-rule pt-3">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-medium">“{o.label}”</span>
                  <span className="tabular shrink-0 text-2xl font-semibold">
                    {o.count}
                    <span className="ml-1 text-xs font-normal text-muted">{o.count === 1 ? "post" : "posts"}</span>
                  </span>
                </div>
                {o.whatDevelopersSay && <p className="mt-1 text-sm">{o.whatDevelopersSay}</p>}
                <ul className="mt-2 space-y-1">
                  {o.posts.slice(0, 3).map((p) => (
                    <li key={p.postId} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                      <a href={p.url} target="_blank" rel="noreferrer" className="text-muted hover:text-ink hover:underline">
                        {p.title}
                      </a>
                      <SourceLabel source={p.source} />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No post echoed a sales objection this week.</p>
        )}
        {withoutSignals.length > 0 && (
          <p className="mt-6 text-sm text-muted">No posts this week for: {withoutSignals.map((o) => `“${o.label}”`).join(", ")}.</p>
        )}
      </BriefSection>

      <BriefSection
        id="monday"
        number={5}
        question="For Monday's sprint planning"
        lead="Three points to raise with the team. They describe what developers say; what goes into the sprint is your call."
        aside={<CopyForDocButton markdown={markdown} />}
      >
        {brief.talkingPoints.length > 0 ? (
          <ol className="grid gap-6 md:grid-cols-3">
            {brief.talkingPoints.map((p, i) => (
              <li key={i} className="flex gap-3 rounded-md border border-rule bg-surface p-4">
                <span className="tabular font-serif text-2xl leading-none text-muted">{i + 1}</span>
                <p className="leading-relaxed">{p}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted">No talking points this week. The AI summary was unavailable or did not pass verification.</p>
        )}
      </BriefSection>

      <section aria-labelledby="method-heading" className="flex flex-col gap-3 rounded-md border border-rule bg-surface p-5 text-sm">
        <h2 id="method-heading" className="flex items-center gap-2 font-semibold">
          <ShieldCheck aria-hidden="true" className="size-4" />
          How this was measured
        </h2>
        <p className="tabular text-muted">
          {brief.totals.fetched} posts collected, {brief.totals.relevant} judged relevant by Gemini. Every count above is computed in code, not by the AI.
          {brief.verification
            ? ` ${brief.verification.itemsKept} of ${brief.verification.itemsReceived} AI statements passed verification against their source threads.`
            : ""}
        </p>
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          {SOURCES.map((s) => {
            const st = brief.sources[s];
            if (!st) return null;
            return (
              <li key={s} className="flex items-center gap-1.5" title={st.error ?? undefined}>
                {st.ok ? <CheckCircle2 aria-hidden="true" className="size-4 text-muted" /> : <XCircle aria-hidden="true" className="size-4 text-rising" />}
                <SourceLabel source={s} className="text-ink" />
                <span className="tabular text-muted">{st.ok ? `${st.count} posts` : "failed"}</span>
                <span className="sr-only">{st.ok ? "OK" : `Failed: ${st.error}`}</span>
              </li>
            );
          })}
        </ul>
        <p className="text-muted">
          Details for every run are in the{" "}
          <Link href="/runs" className="underline">
            run log
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
