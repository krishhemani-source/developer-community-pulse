// "/topics/[id]" Topic drill-down: trend across all weeks, every tagged post (filterable), pain points.
import Link from "next/link";
import { notFound } from "next/navigation";
import { ResolutionLabel, SourceLabel } from "@/components/source-icon";
import { LoadError, PageTitle } from "@/components/states";
import { TopicTrendChart } from "@/components/topic-trend-chart";
import { Button } from "@/components/ui/button";
import { formatShare } from "@/lib/brief";
import { SOURCE_LABELS, SOURCES, type SourceName } from "@/lib/collectors/types";
import { loadSettings } from "@/lib/config";
import { RESOLUTIONS, RESOLUTION_LABELS, type Resolution } from "@/lib/metrics";
import { getTopicDetail, load } from "@/lib/queries";
import { formatWeekRange, shortDate } from "@/lib/weeks";

export const dynamic = "force-dynamic";

const selectClass = "h-9 rounded-md border border-rule bg-surface px-2 text-sm text-ink";

export default async function TopicPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ source?: string; status?: string }>;
}) {
  const { id } = await params;
  const filters = await searchParams;
  const topicId = Number(id);
  if (!Number.isInteger(topicId)) notFound();

  const result = await load(async () => {
    const settings = await loadSettings();
    return getTopicDetail(topicId, settings.unresolved_min_age_hours, settings.timezone);
  });
  if (!result.ok) return <LoadError result={result} />;
  if (!result.data) notFound();
  const { topic, snapshots, posts } = result.data;

  const source = SOURCES.includes(filters.source as SourceName) ? (filters.source as SourceName) : null;
  const status = RESOLUTIONS.includes(filters.status as Resolution) ? (filters.status as Resolution) : null;
  const filtered = posts.filter((p) => (!source || p.source === source) && (!status || p.resolution === status));

  // Pain points from the most recent week that has posts.
  const latestWeek = posts.reduce<string | null>((max, p) => (max === null || p.week_start > max ? p.week_start : max), null);
  const painPointCounts = new Map<string, number>();
  for (const p of posts) {
    if (p.week_start === latestWeek && p.pain_point) painPointCounts.set(p.pain_point, (painPointCounts.get(p.pain_point) ?? 0) + 1);
  }
  const painPoints = [...painPointCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  const latest = snapshots[snapshots.length - 1];

  return (
    <div className="flex flex-col gap-12">
      <div>
        <Link href="/" className="text-sm text-muted hover:text-ink">
          Back to the brief
        </Link>
        <div className="mt-3">
          <PageTitle title={topic.name}>
            {topic.description}
            {!topic.is_active && <span className="ml-2 font-medium text-ink">(inactive: kept for history)</span>}
          </PageTitle>
        </div>
        {latest && (
          <dl className="tabular -mt-4 flex flex-wrap gap-x-10 gap-y-3">
            <div>
              <dt className="text-xs text-muted">Mentions, latest week</dt>
              <dd className="text-3xl font-semibold">{latest.mention_count}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Unresolved share</dt>
              <dd className="text-3xl font-semibold">{formatShare(latest.unresolved_share)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Weeks of history</dt>
              <dd className="text-3xl font-semibold">{snapshots.length}</dd>
            </div>
          </dl>
        )}
      </div>

      <section aria-labelledby="trend-heading">
        <h2 id="trend-heading" className="border-b border-ink pb-2 text-lg font-semibold">
          Mentions by week
        </h2>
        {snapshots.length > 0 ? (
          <div className="mt-4">
            <TopicTrendChart data={snapshots} />
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">No weeks measured yet. Run the pipeline or build history from the brief page.</p>
        )}
      </section>

      <section aria-labelledby="pain-heading">
        <h2 id="pain-heading" className="border-b border-ink pb-2 text-lg font-semibold">
          Pain points{latestWeek ? `, week of ${shortDate(latestWeek)}` : ""}
        </h2>
        {painPoints.length > 0 ? (
          <ul className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {painPoints.map(([text, n]) => (
              <li key={text} className="flex items-baseline justify-between gap-3 border-b border-rule py-1.5 text-sm">
                <span>{text}</span>
                <span className="tabular text-muted">{n}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">No discussion this week.</p>
        )}
      </section>

      <section aria-labelledby="posts-heading">
        <div className="flex flex-col gap-3 border-b border-ink pb-2 sm:flex-row sm:items-end sm:justify-between">
          <h2 id="posts-heading" className="text-lg font-semibold">
            Tagged posts <span className="tabular text-sm font-normal text-muted">({filtered.length} of {posts.length})</span>
          </h2>
          <form className="flex flex-wrap items-end gap-2" method="get">
            <label className="flex flex-col gap-1 text-xs text-muted">
              Source
              <select name="source" defaultValue={source ?? ""} className={selectClass}>
                <option value="">All sources</option>
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {SOURCE_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Resolution
              <select name="status" defaultValue={status ?? ""} className={selectClass}>
                <option value="">Any status</option>
                {RESOLUTIONS.map((r) => (
                  <option key={r} value={r}>
                    {RESOLUTION_LABELS[r]}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" variant="outline" size="sm" className="h-9">
              Apply filters
            </Button>
          </form>
        </div>
        {filtered.length === 0 ? (
          <p className="mt-4 text-sm text-muted">{posts.length === 0 ? "No discussion recorded for this topic yet." : "No posts match these filters."}</p>
        ) : (
          <ul className="divide-y divide-rule">
            {filtered.map((p) => (
              <li key={`${p.id}-${p.week_start}`} className="py-3">
                <a href={p.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                  {p.title}
                </a>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <SourceLabel source={p.source} />
                  <ResolutionLabel resolution={p.resolution} />
                  <span className="tabular text-xs text-muted">
                    {p.score} score · {p.comment_count} comments · {shortDate(p.created_at.slice(0, 10))}
                    {p.author_handle ? ` · ${p.author_handle}` : ""}
                  </span>
                </div>
                {p.pain_point && <p className="mt-1 text-sm text-muted">“{p.pain_point}”</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {snapshots.length > 0 && (
        <p className="text-xs text-muted">
          Showing {formatWeekRange(snapshots[0].week_start, snapshots[snapshots.length - 1].week_start)} of stored history.
        </p>
      )}
    </div>
  );
}
