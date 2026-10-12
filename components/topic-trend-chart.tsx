"use client";
// Trend line for one topic across every stored week.
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { shortDate } from "@/lib/weeks";

export function TopicTrendChart({ data }: { data: { week_start: string; mention_count: number; unresolved_share: number | null }[] }) {
  const rows = data.map((d) => ({
    week: shortDate(d.week_start),
    mentions: d.mention_count,
    unresolved: d.unresolved_share === null ? null : Math.round(d.unresolved_share * 100),
  }));
  return (
    <div className="h-64 w-full" role="img" aria-label={`Mentions by week: ${rows.map((r) => `${r.week} ${r.mentions}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 12, right: 12, bottom: 4, left: -8 }}>
          <CartesianGrid stroke="var(--rule)" strokeDasharray="2 4" vertical={false} />
          <XAxis dataKey="week" tick={{ fill: "var(--muted)", fontSize: 12 }} stroke="var(--rule)" />
          <YAxis allowDecimals={false} tick={{ fill: "var(--muted)", fontSize: 12 }} stroke="var(--rule)" width={40} />
          <Tooltip
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--rule)", borderRadius: 6, fontSize: 12, color: "var(--ink)" }}
            formatter={(value, name) => [name === "unresolved" ? `${value}%` : value, name === "unresolved" ? "Unresolved share" : "Mentions"]}
          />
          <Line type="linear" dataKey="mentions" stroke="var(--ink)" strokeWidth={2} dot={{ r: 3, fill: "var(--ink)" }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
