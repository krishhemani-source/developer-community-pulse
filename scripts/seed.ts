// npm run db:seed
// Inserts Sumit's starting taxonomy (topics, keywords, sales objections, settings).
// Only inserts into empty tables, so it never overwrites edits made in the Settings page.
// This is the ONLY seeded data. There are no seeded posts anywhere.
import "./env";
import { query, queryOne } from "../lib/db";

const TOPICS: { name: string; description: string; color: string; keywords: string[] }[] = [
  {
    name: "False positives and noisy feedback",
    description: "Automated review or lint output that flags non-issues, so developers stop trusting it.",
    color: "#B45309",
    keywords: ["false positive", "noisy review comments", "linter false positive", "review bot noise", "AI review noise"],
  },
  {
    name: "CI/CD integration pain",
    description: "Trouble wiring checks into pipelines: slow builds, flaky tests, failing or slow CI.",
    color: "#0F766E",
    keywords: ["CI integration", "GitHub Actions slow", "flaky tests", "CI pipeline failing", "build times"],
  },
  {
    name: "Slow reviews and PR bottlenecks",
    description: "Pull requests waiting on reviewers and long review turnaround slowing delivery.",
    color: "#1D4ED8",
    keywords: ["code review bottleneck", "waiting for review", "PR review time", "pull request stuck", "review turnaround"],
  },
  {
    name: "Code review culture",
    description: "How teams review: nitpicking, rubber-stamping, fatigue and unhealthy review dynamics.",
    color: "#7C3AED",
    keywords: ["code review culture", "nitpicking code review", "rubber stamp review", "review fatigue", "toxic code review"],
  },
  {
    name: "AI code review tools",
    description: "Experiences with AI or automated reviewers such as Copilot review, CodeRabbit or LLM bots.",
    color: "#BE185D",
    keywords: ["AI code review", "automated code review", "Copilot code review", "CodeRabbit", "LLM code review"],
  },
  {
    name: "Large PRs and review quality",
    description: "Oversized pull requests, stacked PRs and changes that are hard to review well.",
    color: "#4D7C0F",
    keywords: ["large pull request", "PR size", "stacked PRs", "hard to review", "review quality"],
  },
  {
    name: "Security and static analysis",
    description: "SAST, static analysis, security scanning and dependency vulnerability tooling.",
    color: "#475569",
    keywords: ["static analysis", "SAST", "SonarQube", "security scanning", "dependency vulnerabilities"],
  },
];

const OBJECTIONS = [
  "AI review comments are too noisy to trust",
  "The tool does not understand our codebase context",
  "It slows down our CI pipeline",
  "We cannot send our code to a third-party service",
  "Developers ignore bot comments",
  "Our linters and existing checks already cover this",
];

const SETTINGS: Record<string, unknown> = {
  recipient_email: "",
  devto_tags: ["codereview", "cicd", "devops", "githubactions", "testing", "productivity"],
  timezone: "Asia/Kolkata",
  low_signal_threshold: 5,
  unresolved_min_age_hours: 48,
};

async function count(table: string): Promise<number> {
  const row = await queryOne<{ n: number }>(`SELECT count(*)::int AS n FROM ${table}`);
  return row?.n ?? 0;
}

async function main() {
  if ((await count("topics")) === 0) {
    for (const [index, topic] of TOPICS.entries()) {
      const row = await queryOne<{ id: number }>(
        `INSERT INTO topics (name, description, color, sort_order) VALUES ($1, $2, $3, $4) RETURNING id`,
        [topic.name, topic.description, topic.color, index + 1],
      );
      for (const phrase of topic.keywords) {
        await query(`INSERT INTO keywords (topic_id, phrase) VALUES ($1, $2)`, [row!.id, phrase]);
      }
    }
    console.log(`Seeded ${TOPICS.length} topics and ${TOPICS.length * 5} keywords.`);
  } else {
    console.log("topics already has rows: skipped topics and keywords.");
  }

  if ((await count("sales_objections")) === 0) {
    for (const label of OBJECTIONS) {
      await query(`INSERT INTO sales_objections (label) VALUES ($1)`, [label]);
    }
    console.log(`Seeded ${OBJECTIONS.length} sales objections.`);
  } else {
    console.log("sales_objections already has rows: skipped.");
  }

  // Settings are inserted key by key; existing keys are left alone.
  for (const [key, value] of Object.entries(SETTINGS)) {
    await query(`INSERT INTO settings (key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO NOTHING`, [
      key,
      JSON.stringify(value),
    ]);
  }
  console.log("Settings ensured.");
}

main().catch((err) => {
  console.error("Seed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
