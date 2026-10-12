// The Weekly Intelligence Brief header card: the week, the one takeaway, four numbers that frame it, and a section index.
// Every number here is computed in code from the saved brief; the headline is Gemini's verified text.
import Link from "next/link";
import { type BriefContent, formatDelta, readingMinutes } from "@/lib/brief";
import { cn } from "@/lib/utils";
import { formatWeekRange } from "@/lib/weeks";
import { BRAND } from "./brand";
import { CountUp } from "./count-up";
import { TONE_TEXT, TrendIcon } from "./trend";

export const BRIEF_SECTIONS = [
  { id: "surfacing", label: "What's surfacing" },
  { id: "moving", label: "Emerging signals" },
  { id: "unsolved", label: "What's unsolved" },
  { id: "sales", label: "What sales hears" },
  { id: "monday", label: "For Monday" },
];

/** Topics need at least this many posts before we call them "the most unresolved". */
const MIN_POSTS_FOR_UNRESOLVED = 3;

export function heroStats(brief: BriefContent) {
  const active = brief.topics.filter((t) => t.mentionCount > 0);
  const total = brief.topics.reduce((sum, t) => sum + t.mentionCount, 0);
  const hasPrevious = brief.topics.some((t) => t.previousCount !== null);
  const previousTotal = brief.topics.reduce((sum, t) => sum + (t.previousCount ?? 0), 0);
  const totalDelta = hasPrevious ? total - previousTotal : null;
  const totalPct = hasPrevious && previousTotal >= brief.lowSignalThreshold ? Math.round(((total - previousTotal) / previousTotal) * 100) : null;
  const rising = active.filter((t) => t.trend === "rising" || t.trend === "new");
  const mostUnresolved =
    active
      .filter((t) => t.unresolvedShare !== null && t.judgedCount >= MIN_POSTS_FOR_UNRESOLVED)
      .sort((a, b) => (b.unresolvedShare ?? 0) - (a.unresolvedShare ?? 0) || b.mentionCount - a.mentionCount)[0] ?? null;
  const objectionPosts = brief.objections.reduce((sum, o) => sum + o.count, 0);
  const objectionsHit = brief.objections.filter((o) => o.count > 0).length;
  return { total, totalDelta, totalPct, rising, mostUnresolved, objectionPosts, objectionsHit, activeTopics: active.length, readMinutes: readingMinutes(brief) };
}

export function BriefHero({ brief, meta }: { brief: BriefContent; meta?: React.ReactNode }) {
  const s = heroStats(brief);
  const totalTrend = s.totalDelta === null ? "no history" : s.totalDelta > 0 ? "rising" : s.totalDelta < 0 ? "falling" : "steady";

  return (
    <section aria-labelledby="brief-heading" className="flex flex-col gap-8">
      <div className="relative overflow-hidden rounded-2xl border border-rule bg-surface px-5 py-6 sm:px-8 sm:py-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full border border-ink/[0.05]" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 size-44 rounded-full border border-ink/[0.07]" />
        <div className="relative flex flex-col gap-1">
          <h2 id="brief-heading" className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-sm font-semibold text-ink">{BRAND.brief}</span>
            <span className="tabular text-base font-semibold text-ink">{formatWeekRange(brief.weekStart, brief.weekEnd)}</span>
            <span className="tabular text-sm text-muted">≈ {s.readMinutes} min read</span>
          </h2>
          {meta}
        </div>
        <p className="relative mt-5 max-w-4xl font-serif text-[1.75rem] leading-[1.25] tracking-tight text-balance sm:text-[2.3rem]">
          {brief.headline}
        </p>
      </div>

      <dl className="grid grid-cols-2 rounded-2xl border border-rule bg-surface px-5 sm:px-6 lg:grid-cols-4">
        <Stat label="Relevant discussions" href="#surfacing">
          <span className="text-4xl font-semibold leading-none tracking-tight">
            <CountUp value={s.total} />
          </span>
          <span className={cn("tabular mt-2 inline-flex items-center gap-0.5 text-sm font-medium", s.totalDelta === null ? "text-muted" : TONE_TEXT[totalTrend === "rising" ? "rising" : totalTrend === "falling" ? "falling" : "steady"])}>
            {s.totalDelta !== null && s.totalDelta !== 0 && <TrendIcon label={totalTrend} />}
            {s.totalDelta === null ? "No last week to compare" : `${formatDelta(s.totalDelta, s.totalPct)} vs last week`}
          </span>
          <span className="mt-1 text-xs text-muted">across {s.activeTopics} of {brief.topics.length} topics</span>
        </Stat>

        <Stat label="Topics rising" href="#moving">
          <span className={cn("text-4xl font-semibold leading-none tracking-tight", s.rising.length > 0 && "text-rising")}>
            <CountUp value={s.rising.length} />
          </span>
          <span className="mt-2 line-clamp-3 text-sm">{s.rising.length > 0 ? s.rising.map((t) => t.name).join(", ") : "Nothing is rising sharply"}</span>
        </Stat>

        <Stat label="Most unresolved" href="#unsolved">
          <span className="text-4xl font-semibold leading-none tracking-tight">
            {s.mostUnresolved ? <CountUp value={Math.round((s.mostUnresolved.unresolvedShare ?? 0) * 100)} suffix="%" /> : "–"}
          </span>
          <span className="mt-2 line-clamp-3 text-sm">{s.mostUnresolved ? `of ${s.mostUnresolved.name} posts have no working fix` : "Too few judged posts this week"}</span>
        </Stat>

        <Stat label="Echo sales objections" href="#sales">
          <span className="text-4xl font-semibold leading-none tracking-tight">
            <CountUp value={s.objectionPosts} />
          </span>
          <span className="mt-2 text-sm">
            {s.objectionPosts > 0 ? `posts across ${s.objectionsHit} of ${brief.objections.length} objections` : "No posts matched an objection"}
          </span>
        </Stat>
      </dl>

      <nav aria-label="Brief sections" className="no-print">
        <ol className="flex flex-wrap gap-x-1 gap-y-2 text-sm">
          {BRIEF_SECTIONS.map((sec, i) => (
            <li key={sec.id}>
              <a href={`#${sec.id}`} className="inline-flex items-center gap-2 rounded-md border border-rule bg-surface px-3 py-1.5 hover:border-ink/40">
                <span className="tabular text-muted">{i + 1}</span>
                {sec.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </section>
  );
}

function Stat({ label, href, children }: { label: string; href: string; children: React.ReactNode }) {
  return (
    <div className="border-rule py-5 pr-4 [&:nth-child(2n)]:pl-4 max-lg:[&:nth-child(2n)]:border-l max-lg:[&:nth-child(n+3)]:border-t lg:border-l lg:pl-5 lg:first:border-l-0 lg:first:pl-0">
      <dt className="text-sm text-muted">
        <Link href={href} className="hover:text-ink hover:underline">
          {label}
        </Link>
      </dt>
      <dd className="mt-2 flex flex-col">{children}</dd>
    </div>
  );
}
