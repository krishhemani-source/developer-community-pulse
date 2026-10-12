// The weekly email: a clean HTML version of the brief with inline styles (email clients ignore stylesheets).
// Numbers are rendered from code next to Gemini's verified words.
import { type BriefContent, TREND_TEXT, formatDelta, formatShare, streakText, trendArrow } from "../brief";
import { SOURCE_LABELS } from "../collectors/types";
import { formatWeekRange } from "../weeks";

const INK = "#14213D";
const MUTED = "#5B6478";
const RULE = "#DDE2EA";
const RISING = "#C2410C";
const FALLING = "#0E7490";

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function trendColor(label: string): string {
  if (label === "rising" || label === "new") return RISING;
  if (label === "falling") return FALLING;
  return MUTED;
}

export function renderBriefEmail(brief: BriefContent, dashboardUrl: string | null): { subject: string; html: string } {
  const range = formatWeekRange(brief.weekStart, brief.weekEnd);
  const subject = `Developer pulse, ${range}`;
  const h2 = (t: string) =>
    `<h2 style="font-size:16px;margin:28px 0 8px;color:${INK};border-bottom:1px solid ${RULE};padding-bottom:6px">${esc(t)}</h2>`;
  const link = (title: string, url: string, source: string) =>
    `<a href="${esc(url)}" style="color:${INK}">${esc(title)}</a> <span style="color:${MUTED}">(${esc(source)})</span>`;

  const rows = brief.topics
    .map((t) => {
      if (t.mentionCount === 0) {
        return `<tr><td style="padding:10px 0;border-bottom:1px solid ${RULE};color:${MUTED}">${t.rank}. ${esc(t.name)}: no discussion this week</td></tr>`;
      }
      const streak = streakText(t.streak);
      const evidence = t.evidence
        .slice(0, 2)
        .map((e) => `<li style="margin:2px 0">${link(e.title, e.url, SOURCE_LABELS[e.source])}</li>`)
        .join("");
      return `<tr><td style="padding:12px 0;border-bottom:1px solid ${RULE}">
        <div style="font-weight:600">${t.rank}. ${esc(t.name)}</div>
        <div style="margin:4px 0;font-variant-numeric:tabular-nums">
          <strong style="font-size:18px">${t.mentionCount}</strong> mentions
          <span style="color:${trendColor(t.trend)};font-weight:600">&nbsp;${trendArrow(t.trend)} ${esc(formatDelta(t.delta, t.pct))} ${esc(TREND_TEXT[t.trend])}</span>
          ${streak ? `<span style="color:${MUTED}">&nbsp;· ${esc(streak)}</span>` : ""}
          <span style="color:${MUTED}">&nbsp;· ${formatShare(t.unresolvedShare)} unresolved</span>
        </div>
        ${t.insight ? `<div style="margin:4px 0">${esc(t.insight)}</div>` : ""}
        ${evidence ? `<ul style="margin:4px 0;padding-left:18px;font-size:13px">${evidence}</ul>` : ""}
      </td></tr>`;
    })
    .join("");

  const underserved = brief.underserved
    .map((u) => {
      const topic = brief.topics.find((t) => t.id === u.topicId);
      const ev = u.evidence[0];
      return `<li style="margin:6px 0"><strong>${esc(topic?.name ?? "Topic")}</strong> (${formatShare(topic?.unresolvedShare ?? null)} unresolved): ${esc(u.whyUnresolved)}${ev ? `<br><span style="font-size:13px">${link(ev.title, ev.url, SOURCE_LABELS[ev.source])}</span>` : ""}</li>`;
    })
    .join("");

  const objections = brief.objections
    .filter((o) => o.count > 0)
    .map((o) => {
      const p = o.posts[0];
      return `<li style="margin:6px 0"><strong>${esc(o.label)}</strong>: ${o.count} posts${o.whatDevelopersSay ? `. ${esc(o.whatDevelopersSay)}` : ""}${p ? `<br><span style="font-size:13px">${link(p.title, p.url, SOURCE_LABELS[p.source])}</span>` : ""}</li>`;
    })
    .join("");

  const points = brief.talkingPoints.map((p) => `<li style="margin:6px 0">${esc(p)}</li>`).join("");
  const notes = brief.notes.map((n) => `<li>${esc(n)}</li>`).join("");

  const html = `<!doctype html><html><body style="margin:0;background:#F5F7FA">
  <div style="max-width:640px;margin:0 auto;padding:24px 20px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${INK};font-size:15px;line-height:1.5">
    <div style="color:${MUTED};font-size:13px">Developer Community Pulse · ${esc(range)}</div>
    <p style="font-family:Georgia,serif;font-size:21px;line-height:1.35;margin:10px 0 0">${esc(brief.headline)}</p>
    ${h2("Pain points, ranked by mentions")}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows}</table>
    ${underserved ? `${h2("Underserved: frequent and mostly unresolved")}<ul style="padding-left:18px">${underserved}</ul>` : ""}
    ${objections ? `${h2("Sales objection signals")}<ul style="padding-left:18px">${objections}</ul>` : ""}
    ${points ? `${h2("Monday talking points")}<ol style="padding-left:18px">${points}</ol>` : ""}
    ${notes ? `<ul style="color:${MUTED};font-size:13px;padding-left:18px;margin-top:20px">${notes}</ul>` : ""}
    ${dashboardUrl ? `<p style="margin-top:24px"><a href="${esc(dashboardUrl)}" style="color:${INK};font-weight:600">Open the dashboard</a></p>` : ""}
    <p style="color:${MUTED};font-size:12px;margin-top:24px;border-top:1px solid ${RULE};padding-top:10px">This brief measures and explains. Sprint decisions stay with you.</p>
  </div></body></html>`;

  return { subject, html };
}
