// npm run collect:test
// Calls all four live APIs for the last 7 days and prints counts per source.
// Uses the seed keywords so it works before the database is set up.
// Pass --db to use the active keywords and Dev.to tags from the database instead.
import "./env";
import { collectAll } from "../lib/collectors";
import { SOURCE_LABELS, SOURCES } from "../lib/collectors/types";

const SEED_KEYWORDS = [
  "false positive", "noisy review comments", "linter false positive", "review bot noise", "AI review noise",
  "CI integration", "GitHub Actions slow", "flaky tests", "CI pipeline failing", "build times",
  "code review bottleneck", "waiting for review", "PR review time", "pull request stuck", "review turnaround",
  "code review culture", "nitpicking code review", "rubber stamp review", "review fatigue", "toxic code review",
  "AI code review", "automated code review", "Copilot code review", "CodeRabbit", "LLM code review",
  "large pull request", "PR size", "stacked PRs", "hard to review", "review quality",
  "static analysis", "SAST", "SonarQube", "security scanning", "dependency vulnerabilities",
];
const SEED_TAGS = ["codereview", "cicd", "devops", "githubactions", "testing", "productivity"];

async function main() {
  let keywords = SEED_KEYWORDS;
  let devtoTags = SEED_TAGS;
  if (process.argv.includes("--db")) {
    const { loadConfig } = await import("../lib/config");
    const config = await loadConfig();
    keywords = config.keywords.map((k) => k.phrase);
    devtoTags = config.settings.devto_tags;
  }

  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  console.log(`Collecting ${start.toISOString()} -> ${end.toISOString()} for ${keywords.length} keywords...\n`);
  const t0 = Date.now();
  const result = await collectAll({ keywords, devtoTags, start, end });

  for (const source of SOURCES) {
    const s = result.sourceStatus[source];
    const quota = s.quotaRemaining !== null ? `, quota left ${s.quotaRemaining}` : "";
    console.log(
      `${SOURCE_LABELS[source].padEnd(16)} ${s.ok ? "ok    " : "FAILED"} ${String(s.count).padStart(4)} posts, ${s.requests} requests${quota}`,
    );
    if (s.error) console.log(`    error: ${s.error}`);
    for (const w of s.warnings.slice(0, 3)) console.log(`    note: ${w}`);
  }
  console.log(`\nTotal ${result.posts.length} posts (before dedupe) in ${((Date.now() - t0) / 1000).toFixed(1)}s.`);
  const sample = result.posts.slice(0, 3);
  for (const p of sample) console.log(`  e.g. [${p.source}] ${p.title.slice(0, 90)}  ${p.url}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
