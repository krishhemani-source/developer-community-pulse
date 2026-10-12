// "/about" How SignalForge works: the problem, the three questions, the pipeline, the boundary
// and the reliability design, with live numbers from the database.
import { Bot, Calculator, CheckCircle2, ShieldCheck, User } from "lucide-react";
import Link from "next/link";
import { BRAND } from "@/components/brand";
import { LoadError } from "@/components/states";
import { getSystemStats, load } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "How it works" };

const QUESTIONS = [
  { q: "What pain points are surfacing most?", a: "Topics ranked by mention count, each with example pain points and links to real threads.", href: "/#surfacing" },
  { q: "Are they trending up or down?", a: "Change against last week, a four-week sparkline and streaks such as “rising 3 weeks in a row”.", href: "/#moving" },
  { q: "Which problems are unresolved or underserved?", a: "Resolution status per topic and an opportunity quadrant of frequency against unresolved share.", href: "/#unsolved" },
];

const PIPELINE: { step: string; who: "code" | "ai"; what: string }[] = [
  { step: "Collect", who: "code", what: "Hacker News, Stack Overflow, GitHub Issues and Dev.to, searched for every active keyword in parallel." },
  { step: "Clean", who: "code", what: "Remove duplicates and bot-generated reports, strip HTML, keep the 400 most engaged posts." },
  { step: "Tag", who: "ai", what: "Gemini Flash reads each post: is it relevant, which topic, what is the pain point, is it unresolved, does it echo a sales objection." },
  { step: "Measure", who: "code", what: "Counts, week-over-week change, trend labels, streaks, resolution status and the underserved score. Unit-tested." },
  { step: "Write", who: "ai", what: "Gemini drafts the headline, insights and talking points from the computed numbers, without writing any numbers itself." },
  { step: "Verify", who: "code", what: "Every claim must cite real posts for the right topic; text with digits is dropped; the headline must name the week’s key topic." },
  { step: "Deliver", who: "code", what: "Saved to the archive first, then emailed every Friday at 08:00 IST." },
];

export default async function AboutPage() {
  const result = await load(getSystemStats);
  if (!result.ok) return <LoadError result={result} />;
  const s = result.data;
  const keptPct = s.aiStatements > 0 ? Math.round((s.aiStatementsKept / s.aiStatements) * 100) : null;

  return (
    <div className="flex flex-col gap-16">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold text-accent">How it works</p>
        <h1 className="mt-2 font-serif text-[2.2rem] leading-tight tracking-tight sm:text-[2.6rem]">{BRAND.tagline}</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-muted">
          Sumit is the only PM at a 15-person startup selling code review automation. Every Friday he spent 90 minutes searching developer communities
          and pasting notes into a Google Doc. His notes had no memory and no counting: he suspected “false positive rate” kept coming up, but could
          not say whether it appeared 4 times or 14, or whether it had been growing for a month.
        </p>
        <p className="mt-4 text-[17px] font-medium leading-relaxed">
          The problem is measurement, not finding. {BRAND.name} counts, compares and verifies, so he walks into sprint planning with data instead of
          intuition.
        </p>
      </header>

      <Block number="01" title="Three questions, answered every week">
        <ol className="grid gap-8 md:grid-cols-3">
          {QUESTIONS.map((x, i) => (
            <li key={x.q} className="border-t-2 border-accent/70 pt-4">
              <span className="tabular text-xs font-semibold text-accent">Question {i + 1}</span>
              <h3 className="mt-2 font-serif text-xl leading-snug">{x.q}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{x.a}</p>
              <Link href={x.href} className="mt-3 inline-block text-sm font-medium text-accent hover:underline">
                See it in this week’s brief
              </Link>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-sm text-muted">
          Plus one more: the objections Sumit’s sales team hears in demos are stored in the database, and each week posts that echo them are counted
          and linked.
        </p>
      </Block>

      <Block number="02" title="The pipeline: AI interprets, code counts">
        <ol className="divide-y divide-rule border-y border-rule">
          {PIPELINE.map((p, i) => (
            <li key={p.step} className="grid grid-cols-[2rem_1fr] gap-x-4 gap-y-1 py-4 sm:grid-cols-[2rem_7rem_8rem_1fr] sm:items-baseline">
              <span className="tabular text-sm text-muted">{i + 1}</span>
              <span className="font-semibold">{p.step}</span>
              <span
                className={cn(
                  "col-start-2 inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium sm:col-start-auto",
                  p.who === "ai" ? "bg-accent-soft text-ink" : "border border-rule text-muted",
                )}
              >
                {p.who === "ai" ? <Bot aria-hidden="true" className="size-3.5 text-accent" /> : <Calculator aria-hidden="true" className="size-3.5" />}
                {p.who === "ai" ? "Gemini Flash" : "Code"}
              </span>
              <span className="col-start-2 text-sm leading-relaxed text-muted sm:col-start-auto">{p.what}</span>
            </li>
          ))}
        </ol>
      </Block>

      <Block number="03" title="Nothing unverified reaches Sumit">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4">
          <Fact label="AI statements that passed verification" value={keptPct === null ? "–" : `${keptPct}%`} note={`${s.aiStatementsKept} of ${s.aiStatements} across ${s.briefs} briefs`} />
          <Fact label="Invalid citations stripped" value={String(s.citationsRemoved)} note="Gemini cited a post it was not given, or one from another topic" />
          <Fact label="Posts read" value={s.postsFetched.toLocaleString("en-IN")} note={`${s.postsRelevant.toLocaleString("en-IN")} judged relevant and counted`} />
          <Fact label="Collection runs" value={String(s.runs)} note={`${s.succeeded} succeeded · ${s.partial} partial · ${s.failed} failed, all in the run log`} />
        </dl>
        <ul className="mt-10 grid gap-x-10 gap-y-4 text-sm leading-relaxed md:grid-cols-2">
          {[
            "Gemini never counts. Every number comes from code covered by unit tests.",
            "Every Gemini response is checked against a schema; broken output is retried once, then skipped and logged.",
            "Each claim must cite posts that exist, for the right topic. Items left without evidence are dropped.",
            "Text containing digits is dropped, so numbers can only come from code.",
            "The headline must name the week’s most discussed or fastest-rising topic, or code writes it instead.",
            "If a source or Gemini fails, the run is marked partial and the brief says what is missing.",
          ].map((t) => (
            <li key={t} className="flex gap-2.5">
              <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent" />
              {t}
            </li>
          ))}
        </ul>
      </Block>

      <Block number="04" title="Where the machine stops">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <h3 className="flex items-center gap-2 font-semibold">
              <Bot aria-hidden="true" className="size-4 text-accent" />
              Automated
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              {["Collecting posts", "Filtering, deduplicating and tagging", "Counting and trend calculation", "Detecting unresolved problems", "Drafting the brief"].map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="flex items-center gap-2 font-semibold">
              <User aria-hidden="true" className="size-4" />
              Stays human
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              {["Deciding what goes into the sprint", "Editing topics, keywords and objections", "Any outreach to developers or communities"].map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-8 max-w-3xl text-sm leading-relaxed text-muted">
          Deliberately not built: auto-created roadmap tickets, auto-replies in communities, and any “what to build next” recommendation. The system
          measures and explains. Sumit decides.
        </p>
      </Block>

      <Block number="05" title="What success looks like">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4">
          <Fact label="Collection time for Sumit" value="0 min" note="was 90 minutes every Friday" />
          <Fact label="Time to read the brief" value="< 10 min" note="headline, four numbers, five sections" />
          <Fact label="Pain points with a trend number" value="100%" note="change vs last week plus four-week history" />
          <Fact label="Claims linked to a source thread" value="100%" note="enforced by verification" />
        </dl>
        <p className="mt-8 flex items-start gap-2 text-sm text-muted">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          Only public post text is sent to Gemini. Author handles are stored for attribution in the UI and never sent. Currently tracking {s.topics}{" "}
          topics, {s.keywords} keywords and {s.objections} sales objections, all editable in{" "}
          <Link href="/settings" className="underline">
            Settings
          </Link>
          .
        </p>
      </Block>
    </div>
  );
}

function Block({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`about-${number}`} className="border-t border-rule pt-7">
      <p aria-hidden="true" className="tabular text-xs font-semibold tracking-wide text-accent">
        {number}
      </p>
      <h2 id={`about-${number}`} className="mt-1.5 text-[1.6rem] font-semibold leading-tight tracking-[-0.015em]">
        {title}
      </h2>
      <div className="mt-7">{children}</div>
    </section>
  );
}

function Fact({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1">
        <span className="tabular block text-4xl font-semibold tracking-tight">{value}</span>
        <span className="mt-1 block text-xs leading-relaxed text-muted">{note}</span>
      </dd>
    </div>
  );
}
