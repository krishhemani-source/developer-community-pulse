"use client";
// Opportunity quadrant: mentions (x) vs unresolved share (y), bubble size = engagement.
// Top right = frequently discussed AND mostly unresolved = "Underserved".
// Bubbles are numbered by rank; the list underneath gives the same data as text and links.
import { useRouter } from "next/navigation";
import {
  CartesianGrid,
  LabelList,
  ReferenceArea,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
  Cell,
} from "recharts";

export interface QuadrantPoint {
  id: number;
  rank: number;
  name: string;
  mentions: number;
  share: number; // 0..100
  engagement: number;
  tone: "rising" | "falling" | "steady";
}

const FILL = { rising: "var(--rising)", falling: "var(--falling)", steady: "var(--steady)" };

export function OpportunityQuadrant({ points }: { points: QuadrantPoint[] }) {
  const router = useRouter();
  const maxX = Math.max(4, ...points.map((p) => p.mentions));
  const midX = Math.ceil(maxX / 2);
  const xMax = Math.ceil(maxX * 1.1);

  if (points.length === 0) {
    return <p className="text-sm text-muted">No topic had enough judged posts to place on the quadrant this week.</p>;
  }

  return (
    <div>
      <div className="h-72 w-full" role="img" aria-label="Opportunity quadrant: mentions against unresolved share. Details listed below.">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 16, right: 16, bottom: 28, left: 0 }}>
            <CartesianGrid stroke="var(--rule)" strokeDasharray="2 4" />
            <ReferenceArea
              x1={midX}
              x2={xMax}
              y1={50}
              y2={100}
              fill="var(--rising-soft)"
              fillOpacity={0.6}
              stroke="none"
              label={{ value: "Underserved", position: "insideTopRight", fill: "var(--ink)", fontSize: 12, fontWeight: 600 }}
            />
            <XAxis
              type="number"
              dataKey="mentions"
              domain={[0, xMax]}
              allowDecimals={false}
              tick={{ fill: "var(--muted)", fontSize: 12 }}
              stroke="var(--rule)"
              label={{ value: "Mentions this week", position: "bottom", offset: 10, fill: "var(--muted)", fontSize: 12 }}
            />
            <YAxis
              type="number"
              dataKey="share"
              domain={[0, 100]}
              ticks={[0, 50, 100]}
              unit="%"
              width={44}
              tick={{ fill: "var(--muted)", fontSize: 12 }}
              stroke="var(--rule)"
            />
            <ZAxis type="number" dataKey="engagement" range={[90, 900]} />
            <Tooltip
              cursor={false}
              content={({ payload }) => {
                const p = payload?.[0]?.payload as QuadrantPoint | undefined;
                if (!p) return null;
                return (
                  <div className="rounded border border-rule bg-surface px-3 py-2 text-xs shadow-sm">
                    <div className="font-medium text-ink">{p.name}</div>
                    <div className="tabular text-muted">
                      {p.mentions} mentions · {p.share}% unresolved · {p.engagement} engagement
                    </div>
                  </div>
                );
              }}
            />
            <Scatter
              data={points}
              cursor="pointer"
              onClick={(entry: unknown) => {
                const p = (entry as { payload?: QuadrantPoint }).payload;
                if (p) router.push(`/topics/${p.id}`);
              }}
            >
              {points.map((p) => (
                <Cell key={p.id} fill={FILL[p.tone]} fillOpacity={0.75} stroke="var(--surface)" strokeWidth={1.5} />
              ))}
              <LabelList dataKey="rank" position="center" fill="var(--surface)" fontSize={11} fontWeight={700} />
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-xs text-muted">Bubble size shows engagement. Colour shows direction: warm rising, cool falling, grey steady.</p>
    </div>
  );
}
