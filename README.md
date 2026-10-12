# SignalForge

**Developer Intelligence. Turn developer noise into product direction.**

SignalForge produces a Weekly Intelligence Brief for Sumit, the only PM at a 15-person startup that sells a code review automation tool. Every Friday at 08:00 IST it reads Hacker News, Stack Overflow, GitHub Issues and Dev.to. It counts which pain points are surfacing, tracks how they trend week over week, finds problems nobody has solved, and emails a brief he can read in under ten minutes.

_The repository, Vercel project and package keep the original working name `developer-community-pulse`; the product name everywhere a user sees it is SignalForge._

> **AI interprets, code counts, nothing unverified reaches Sumit.**

---

## 1. Problem

**The reframe: this is a measurement problem, not a finding problem.**

Sumit already finds discussions. He spends 90 minutes every Friday searching communities and pasting notes into a Google Doc. What he cannot do is **measure**:

- His notes have no memory and no counting.
- He suspects "false positive rate" keeps coming up, but cannot say whether it appeared 4 times or 14 this week, or whether it has been growing for a month.
- Sales keeps hearing the same objections in demos, and nobody connects them to what developers say in public.

The brief answers three questions:

| # | Question | What the system produces |
|---|---|---|
| 1 | What pain points are surfacing most? | Topics ranked by mention count, each with example pain points and links to real threads |
| 2 | Trending up or down vs last week? | Week-over-week change per topic, a trend label, a 4-week sparkline and a streak ("Rising 3 weeks in a row") |
| 3 | Which problems are unresolved or underserved? | Resolution status per topic, and an opportunity quadrant of frequency against unresolved share |

**Differentiator:** Sumit's sales objections are stored in the database. Each week, posts that echo an objection are counted and linked, so a long thread containing "the exact objection sales keeps hearing" surfaces on its own.

**Success metrics:**
- Collection time: 0 minutes (was 90).
- Reading time: under 10 minutes.
- Every pain point carries a trend number.
- 100% of claims link to a source thread.

## 2. Nine Checks

| Check | Answer |
|---|---|
| **Kill switch: is the data public and reachable?** | Yes. Four public APIs, three of which need no key. Reddit is excluded because it blocks cloud servers. |
| **Kill switch: can AI do the judgement reliably?** | Only the reading part. Gemini tags relevance, topic and pain point; code does every count and every trend. Gemini's text is verified against the evidence before anyone sees it. |
| **Kill switch: is there a real, recurring user need?** | Yes. A weekly 90-minute manual ritual, a Monday sprint planning that needs data, and user interviews that are 6 months old. |
| **Sizing: volume** | Roughly 100–500 posts a week, capped at 400 per run. That is 16 Gemini tagging calls and 1 writing call. |
| **Sizing: cost** | The Gemini Flash free tier covers it. Neon, Vercel and Resend free tiers cover the rest. |
| **Sizing: time** | Each run fits inside Vercel's 300-second function limit. Backfill builds one week per request. |
| **Boundary: what is automated?** | Collecting, filtering, deduplicating, tagging, counting, trends, unresolved detection and drafting the brief. |
| **Boundary: what stays human?** | Sprint decisions, editing the taxonomy, and any outreach. |
| **Failure: what if it is wrong?** | Every claim links to its thread. Numbers come from tested code. A failed source or failed AI call degrades the brief visibly instead of silently. |

## 3. The cut

| Automated | Stays human |
|---|---|
| Collecting posts | Deciding what goes into the sprint |
| Filtering, deduplicating and tagging | Editing topics, keywords and objections |
| Counting and trend calculation | Any outreach to developers or communities |
| Detecting unresolved problems | |
| Drafting the brief | |

**What we refused to build, and why:**
- **Auto-created roadmap tickets.** A count is evidence, not a priority. Turning it into a ticket would quietly make the product decision for Sumit.
- **Auto-replies in communities.** These look like spam, risk the company's reputation, and violate community norms.
- **A "what to build next" recommendation.** The model is told explicitly not to recommend. The talking points are prompts for discussion, not decisions.

The footer of every page and email says so: *This brief measures and explains. Sprint decisions stay with you.*

## 4. Architecture

| Tool | One job |
|---|---|
| **Next.js (App Router, TypeScript strict)** on **Vercel** | Pages, API routes and server actions |
| **Vercel Cron** | Triggers the run on Fridays at 02:30 UTC (08:00 IST) |
| **Neon serverless Postgres** (`@neondatabase/serverless`, plain parameterised SQL) | Holds the config (topics, keywords, objections, settings) and all history |
| **Gemini Flash** (`@google/genai`) | Reads posts (tagging) and drafts the brief's words. Server-side only. |
| **zod** | Validates every API response and every Gemini output |
| **Resend** | Delivers the email |
| **Tailwind + shadcn/ui pattern + Recharts + lucide-react** | UI, the quadrant and trend charts, icons |
| **vitest** | Unit tests for metrics, verification, week maths and content filters |

### Pipeline (`lib/pipeline/run.ts`)

```
Collect ─▶ Clean ─▶ Tag ─▶ Measure ─▶ Write ─▶ Verify ─▶ Send
 4 APIs    dedupe   Gemini   CODE      Gemini    CODE     Resend
 parallel  cap 400  batches  counts    words     checks
```

1. **Collect** (`lib/collectors/*`): all four sources run in parallel with `Promise.allSettled`, and every request has a 20-second timeout. If one source fails, the run continues as `partial`.
2. **Clean** (`lib/pipeline/clean.ts`):
   - Deduplicate by source id, then by normalised URL.
   - Strip HTML and cut excerpts to 600 characters.
   - Keep the 400 highest-engagement posts.
   - Upsert into `posts`.
3. **Tag** (`lib/ai/tagPosts.ts`):
   - Batches of 25, at most 3 in parallel, with structured JSON output.
   - Tags with `relevant = false` or `confidence < 0.5` are dropped.
4. **Measure** (`lib/metrics.ts`, `lib/pipeline/measure.ts`): mentions, engagement, resolution status, week-over-week change, trend label, streak, underserved score and objection counts. Results are written to `weekly_snapshots`.
5. **Write** (`lib/ai/writeBrief.ts`): Gemini gets only the computed metrics and the top 5 posts per topic, and is told to write no numbers.
6. **Verify** (`lib/verify.ts`): see section 5.
7. **Send** (`lib/email/sendBrief.ts`): Resend email. The brief is saved first, so a failed email never loses it.

`runs.stage` is updated after every stage, so the UI shows live progress: Collecting → Cleaning → Tagging → Measuring → Writing → Verifying → Sending.

## 5. Reliability design

**"AI interprets, code counts, nothing unverified reaches Sumit."**

- **Gemini never counts.** Every number on screen and in the email comes from `lib/metrics.ts`, which is unit-tested (`tests/metrics.test.ts`).
- **Gemini output is validated twice.**
  - First, `responseSchema` constrains the model to JSON.
  - Then zod checks the result. On invalid JSON or a schema mismatch it retries once.
  - If the retry also fails: during tagging, that batch's posts stay untagged (logged and shown in the brief's notes) and the run continues. During writing, the brief is still saved with code-computed numbers, a code-written headline and the source threads, but without AI commentary.
- **The verification step** (`lib/verify.ts`, tested in `tests/verify.test.ts`) runs on Gemini's draft before it is saved:
  1. Every `evidence_id` must be one of the posts we actually sent, for that same topic or objection. Invalid ids are removed.
  2. Any item left with zero valid evidence is dropped.
  3. Any text containing a digit is dropped, because numbers may only come from code. If the headline fails this check, a code-written headline replaces it.
  4. **Headline grounding.** Code computes the week's key facts (most discussed topic, biggest riser and faller, most unresolved topic, most echoed objection) and Gemini writes the headline from them. The headline must then name the most discussed or fastest-rising topic (`headlineMentionsAny`); if it does not, a code-written headline replaces it.
  5. Unknown topic or objection ids are dropped.
  6. The counts of what was dropped are saved in the run log and shown under the brief ("14 of 16 AI statements passed verification").
- **Idempotent weeks.** Rerunning a week (any run whose window starts within 3 days of an existing week) replaces that week's tags, snapshots and brief. It never doubles them.
- **Run lock.** A partial unique index (`runs_one_running`) lets the database itself refuse a second run while one is `running`. Runs stuck for over 6 minutes are marked failed, which releases the lock.

## 6. Edge cases

| Edge case | Handling |
|---|---|
| First run, no last week | "Build 4-week history" backfills four weeks, oldest first, one per request |
| Small numbers exaggerate change | Percentage hidden when last week < `low_signal_threshold` (5); "Low signal" label when both weeks are below it |
| Ambiguous keywords ("review" for movies, "pipeline" for oil) | Gemini relevance filter runs before anything is counted |
| Same post from two keywords or sources | Deduplicated by (source, id), then by normalised URL |
| Bots and automated reports inflate counts (CI daily reports, status boards, dependency dashboards) | GitHub issues from bot accounts or with report/board/tracker titles are dropped before tagging (`isAutomatedIssue`), and Gemini is told such content is irrelevant |
| A rate-limited source only gets through part of the keyword list | Keywords are searched round-robin across topics (`interleaveByTopic`), so partial coverage is spread evenly instead of favouring the first topics |
| A source is down or rate-limited | Run continues as `partial`; the brief notes the missing source; the source strip shows it failed |
| Stack Exchange `backoff` / quota | Waits `backoff` seconds; stops before the quota runs out; logs `quota_remaining` |
| GitHub search rate limit | Requests spaced 6.1s apart (2.1s with a token) inside a 60s budget; the log says how many keywords were searched |
| Gemini returns broken JSON | zod validation, one retry, then the batch is skipped and logged |
| Gemini overloaded (503) or rate-limited (429) | Waits (honouring Google's `retryDelay`), moves through the fallback Flash models in `GEMINI_FALLBACK_MODEL` (default `gemini-3.6-flash,gemini-3.5-flash-lite`), up to 5 attempts |
| Gemini cites a post that does not exist | Verification removes the citation; items left without evidence are dropped |
| Gemini writes a number | Verification drops that text |
| Gemini's headline leads with the wrong thing | The headline must name the week's most discussed or fastest-rising topic, or a code-written headline is used |
| Brand-new unanswered question | Posts under 48 hours old are `too_new` and excluded from the unresolved share |
| Rerun in the same week | Replaces that week's data (weeks starting within 3 days are treated as the same week) |
| Two runs at once, or button spam | Database-level "already running" lock, plus a 10-minute cooldown on manual runs |
| Vercel Cron runs on UTC | Scheduled at `30 2 * * 5` (02:30 UTC Friday = 08:00 IST); tested in `tests/weeks.test.ts` |
| Function time limit | 400-post cap, batched calls, tagging starts no new batch after 165s, every Gemini call has a hard deadline (tagging by 220s, writing by 280s), and the SDK's hidden retries are switched off, one week per backfill request, `maxDuration = 300` |
| Zero relevant posts in a topic | Shown as "No discussion this week", not hidden |
| Email fails | Brief is saved before sending; `email_status` is shown on the brief and in history |
| Topic or keyword deleted mid-history | Soft delete with `is_active`; history and old briefs stay intact |
| Function killed mid-run | The run is marked failed after 6 minutes with the stage it died in, which releases the lock |

## 7. Data handling

- **Only public post text goes to Gemini:** a temporary id, the source name, the title, a 600-character excerpt and answered/accepted flags. **Author handles are never sent.** They are stored only so the UI can attribute a thread. URLs and source ids are not sent either.
- **Gemini free tier vs billed API.** On the free tier, Google may use prompts and responses to improve its products, and human reviewers may read them. On the paid (billed) tier, Google does not use them to improve products. The content here is already public, but if Sumit later adds private data such as CRM notes, switch the project to billing first. See [Gemini API terms](https://ai.google.dev/gemini-api/terms).
- **Secrets** live only in environment variables, read only in server code (`lib/db.ts`, `lib/ai/gemini.ts`, `lib/email/sendBrief.ts`). None use the `NEXT_PUBLIC_` prefix, so none can reach the browser bundle. `.env` and `.env.local` are git-ignored.
- **Settings protection.** Viewing is public. If `ADMIN_PASSCODE` is set, editing requires it; a hash is kept in an httpOnly cookie. `/api/cron/weekly` requires `Authorization: Bearer $CRON_SECRET`.

## 8. Design decisions

**Why Neon.** One serverless Postgres holds both config and history:
- It has a native Vercel integration, so `DATABASE_URL` is added for you.
- Keeping topics, keywords and objections in tables makes config editable from the UI with no code change, which is the intent of the requirement.
- Plain parameterised SQL with no ORM means every query can be read and explained as written.

**Why these four sources and not Reddit.**
- Together they cover the main places developers talk:
  - Hacker News: opinion and debate.
  - Stack Overflow: concrete questions with a clear answered/accepted state.
  - GitHub Issues: tool-level bugs and feature gaps, with an open/closed state.
  - Dev.to: practitioner write-ups.
- All four have stable public APIs that work from a cloud server.
- **Reddit's public endpoints block requests from cloud IPs** such as Vercel's, so it would fail during the live demo. It is a natural next step once OAuth API access is set up.

**Why counts and resolution status, not sentiment.**
- Sentiment is noisy on technical text ("this linter is killing me" is not product feedback about us) and is hard to act on.
- Counts answer "how often", trends answer "is it growing", and resolution status answers "does anyone solve it yet". That last one is the opportunity signal a PM needs.
- All three are deterministic, testable and explainable in one sentence.

**Brand and visual design.** SignalForge is positioned as a premium developer intelligence product: calm, precise and restrained, closer to a research instrument than a marketing site.
- **Mark:** two concentric signal rings around a central point (`components/brand.tsx`, favicon `app/icon.svg`). The outer ring is broken, like a signal being picked up; the centre point, in electric violet, is the one thing worth acting on.
- **Tokens:**
  - Warm white `#FAF8F4`, deep ink `#0E1020`, muted `#5F6273`, rule `#E7E3DB`.
  - Electric violet `#6B45FF` is the only brand accent, and it is reserved for two meanings: *this is SignalForge* (the mark's centre point, the wordmark) and *you can act here* (primary buttons, the active navigation item, links, focus rings). Section numbers, labels and rules stay ink or grey.
  - Data colour carries meaning only: rising `#C2410C` (warm), falling `#0E7490` (cool), steady muted. Violet is never used for data.
  - A dark mode remaps each token.
- **Colour rule in one line:** violet means *SignalForge* or *act here*; warm orange and cool teal mean *data moved*; nothing else has colour. All twelve colour pairings pass WCAG AA contrast (4.5:1) in light and dark mode.
- **Motion with a job, played once.** Sparklines draw left to right, staggered by rank, so the readout reads like a pulse (time reads left to right). Resolution bars grow from zero (the length is the data). The four key numbers count up once with an ease-out curve. A signal ripple runs only while a pipeline run is live, as system status. Toasts rise in over 200ms. There is deliberately no fade-and-slide on page sections. Durations stay between about 200ms for feedback and 900ms for data reveals, and every animation is switched off for people who ask their OS for reduced motion (WCAG 2.3.3). Numbers are rendered on the server, so they are correct before any animation and in print.
- **Reading time on the brief** ("≈ 3 min read") keeps the *under 10 minutes* success metric visible: prose at 238 words a minute (average adult silent reading, Brysbaert 2019), plus about 6 seconds per topic row and a minute for the charts. Unit-tested.
- **Shareable output:** "Copy for Google Doc" (markdown) and "Save as PDF" (a print stylesheet that shows only the brief, with every animation in its finished state).
- **Vocabulary:** the AI report is the **Weekly Intelligence Brief**; the trend section is **Emerging Signals**.
- **Typefaces:** Inter with tabular figures for everything; Newsreader (serif) only for the headline.
- **Principles:**
  1. Numbers before words.
  2. Colour means direction and nothing else, and always comes with an arrow and a label.
  3. Hairline rules instead of cards.
- **Structure:** the page is organised as the answers to Sumit's three questions (sections 1–3), then sales objections and Monday talking points. A takeaway headline and four key numbers sit on top, so the first ten seconds already say what changed.
- **The one memorable element** is the pulse readout: ranked rows with large tabular counts, direction-coloured deltas and 4-week sparklines.

```
┌────────────────────────────────────────────────────────────────────┐
│ ◎ SignalForge  (sidebar: Intelligence Brief · Archive · Runs · ⚙) │
├────────────────────────────────────────────────────────────────────┤
│ Developer Intelligence                                 [ Run now ] │
│ SignalForge                                                        │
│ Turn developer noise into product direction.                       │
│                                                                    │
│ Weekly Intelligence Brief · 5–12 Oct 2026          last run · email│
│  AI code review tools and CI integration dominate developer        │
│  discussion this week…                                  (serif)    │
│ ┌────────────┬────────────┬────────────┬────────────┐              │
│ │ 86         │ 2          │ 39%        │ 21         │  key numbers │
│ │ discussions│ rising     │ unresolved │ objections │  (all code)  │
│ └────────────┴────────────┴────────────┴────────────┘              │
│ [1 What's surfacing] [2 Emerging] [3 Unsolved] [4 Sales] [5]  │
│                                                                    │
│ 1  What pain points are surfacing most? ────────────────────────── │
│    1 AI code review tools  24  ▲ +3   ╱‾╲_•  ███░░ 32% unresolved   │
│    … insight · Show 5 source threads                               │
│ 2  Emerging Signals ─────────────────────────────────────────────── │
│    ▲ Rising: CI/CD 4 → 21  +17       ▼ Falling: …                  │
│ 3  Which problems are still unsolved? ──────────────────────────── │
│    quadrant ("Underserved" top right)  |  underserved + threads    │
│ 4  What sales hears, developers are saying ─────────────────────── │
│ 5  For Monday's sprint planning ──────────── [ Copy for Google Doc ]│
│ How this was measured: sources, counts, verification                │
└────────────────────────────────────────────────────────────────────┘
```

## 9. Setup

**Requirements:** Node 20 or newer, and free accounts on Neon, Google AI Studio, Resend, Vercel and GitHub.

```bash
npm install
cp .env.example .env.local     # then fill in the values (see the comments in the file)
npm run db:migrate             # creates tables and indexes (safe to rerun)
npm run db:seed                # inserts Sumit's topics, keywords, objections, settings (only into empty tables)
npm run collect:test           # optional: prints live post counts per source for the last 7 days
npm run dev                    # http://localhost:3000
npm test                       # unit tests
```

Then open the app and click **Build 4-week history**.

**Deploy:**
1. Push the code to GitHub.
2. Import the repo in Vercel and add every variable from `.env.example` in Project → Settings → Environment Variables.
3. Deploy.

The cron in `vercel.json` registers itself on deploy. Vercel Cron calls `/api/cron/weekly` with your `CRON_SECRET` as a bearer token, so no webhook setup is needed. To test the cron route by hand:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/cron/weekly
```

**Scripts:**
- `db:migrate`: create the schema.
- `db:seed`: seed the config.
- `collect:test`: live collector check. Add `-- --db` to use the keywords stored in the database.
- `dev`, `build`, `test`, `typecheck`.

## 10. Limitations and next steps

- **Keyword recall.** Posts that describe a pain point in different words are missed. Next step: let Sumit add keywords from the "pain points" Gemini extracts.
- **Backfilled weeks use today's state.** A backfilled Stack Overflow question shows today's answered state, not its state that week. Resolution in backfilled weeks therefore skews towards "resolved".
- **Hacker News and Dev.to resolution** relies on Gemini's `unresolved_signal`. It is less objective than Stack Overflow's accepted answer or GitHub's closed state.
- **GitHub without a token** searches only about 12 of the 35 keywords per run (10 searches/minute). Set `GITHUB_TOKEN` to search all of them.
- **Gemini tagging is probabilistic.** Two runs over the same posts can differ slightly. Confidence filtering and source links let Sumit check any count.
- **The digit rule is strict.** An insight that mentions "OAuth2" or "S3" is dropped. This is a deliberate trade-off for the "numbers only from code" guarantee.
- **Single user.** One recipient and one passcode. Teams would need real auth.
- **Next steps:**
  - Reddit via OAuth.
  - Import the sales team's objections from the CRM.
  - A "mark as read / snooze topic" control.
  - Slack delivery.
  - A weekly diff of new pain-point phrases to suggest keywords.
