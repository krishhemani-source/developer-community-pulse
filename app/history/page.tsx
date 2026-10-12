// "/history" Past briefs by week.
import Link from "next/link";
import { LoadError, PageTitle } from "@/components/states";
import { listBriefs, load } from "@/lib/queries";
import { formatWeekRange } from "@/lib/weeks";

export const dynamic = "force-dynamic";
export const metadata = { title: "Brief archive" };

export default async function HistoryPage() {
  const result = await load(listBriefs);
  if (!result.ok) return <LoadError result={result} />;
  const briefs = result.data;

  return (
    <div>
      <PageTitle title="Brief archive">Every Weekly Intelligence Brief, exactly as SignalForge generated it. Open one to read it.</PageTitle>
      {briefs.length === 0 ? (
        <p className="text-muted">
          No Weekly Intelligence Briefs yet. Go to the{" "}
          <Link href="/" className="underline">
            dashboard
          </Link>{" "}
          and build 4-week history to get started.
        </p>
      ) : (
        <ul className="divide-y divide-rule border-y border-rule">
          {briefs.map((b) => (
            <li key={b.week_start}>
              <Link href={`/history/${b.week_start}`} className="grid gap-1 py-4 hover:bg-ink/[0.03] sm:grid-cols-[12rem_1fr_auto] sm:gap-6">
                <span className="tabular font-medium">{formatWeekRange(b.week_start, b.week_end)}</span>
                <span className="line-clamp-2 text-sm">{b.headline}</span>
                <span className="tabular text-sm text-muted">
                  {b.mentions} mentions · {b.trigger} · email {b.email_status.split(":")[0].replace("_", " ")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
