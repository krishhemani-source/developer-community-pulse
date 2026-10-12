// A 4-week sparkline drawn as plain SVG (server-rendered, no JavaScript needed).
// Paired with screen-reader text listing the actual numbers.
import { shortDate } from "@/lib/weeks";

export function Sparkline({
  series,
  stroke,
  width = 104,
  height = 32,
  delay = 0,
}: {
  series: { weekStart: string; count: number }[];
  stroke: string;
  width?: number;
  height?: number;
  /** Milliseconds before this line starts drawing, to stagger a list. */
  delay?: number;
}) {
  const pad = 4;
  const max = Math.max(1, ...series.map((s) => s.count));
  const step = series.length > 1 ? (width - pad * 2) / (series.length - 1) : 0;
  const points = series.map((s, i) => ({
    x: pad + i * step,
    y: height - pad - (s.count / max) * (height - pad * 2),
  }));
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  const description = series.map((s) => `${shortDate(s.weekStart)}: ${s.count}`).join(", ");

  return (
    <span className="inline-block">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="overflow-visible">
        <line x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} stroke="var(--rule)" strokeWidth={1} />
        {points.length > 1 && (
          <path
            d={path}
            pathLength={1}
            className="sf-draw"
            style={{ animationDelay: `${delay}ms` }}
            fill="none"
            stroke={stroke}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {points.slice(0, -1).map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={1.75} fill={stroke} opacity={0.55} />
        ))}
        {last && <circle className="sf-fade-in" style={{ animationDelay: `${delay + 750}ms` }} cx={last.x} cy={last.y} r={3.25} fill={stroke} />}
      </svg>
      <span className="sr-only">Mentions by week: {description}</span>
    </span>
  );
}
