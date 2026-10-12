-- SignalForge: database schema (Neon Postgres).
-- Safe to run repeatedly: every statement uses IF NOT EXISTS.
-- Statements are separated by semicolons at line end; scripts/migrate.ts runs them one by one.

-- ---------- Config (editable from the Settings page) ----------

CREATE TABLE IF NOT EXISTS topics (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  color       TEXT NOT NULL DEFAULT '#5B6478',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,   -- soft delete: history stays intact
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS keywords (
  id         SERIAL PRIMARY KEY,
  topic_id   INT NOT NULL REFERENCES topics(id),
  phrase     TEXT NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No two active keywords may share the same phrase (case-insensitive).
CREATE UNIQUE INDEX IF NOT EXISTS keywords_active_phrase_unique
  ON keywords (lower(phrase)) WHERE is_active;

CREATE TABLE IF NOT EXISTS sales_objections (
  id          SERIAL PRIMARY KEY,
  label       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

-- Audit trail: every config edit from the UI writes one row here.
CREATE TABLE IF NOT EXISTS config_changes (
  id         SERIAL PRIMARY KEY,
  entity     TEXT NOT NULL,          -- 'topic' | 'keyword' | 'objection' | 'setting'
  entity_id  TEXT NOT NULL,
  action     TEXT NOT NULL,          -- 'create' | 'update' | 'deactivate' | 'activate' | 'reorder'
  before     JSONB,
  after      JSONB,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Pipeline data ----------

CREATE TABLE IF NOT EXISTS runs (
  id             SERIAL PRIMARY KEY,
  trigger        TEXT NOT NULL CHECK (trigger IN ('cron', 'manual', 'backfill')),
  week_start     TIMESTAMPTZ NOT NULL,   -- exact start of the 7-day collection window
  week_end       TIMESTAMPTZ NOT NULL,   -- exact end of the window (the run time, or a past anchor for backfill)
  status         TEXT NOT NULL CHECK (status IN ('running', 'success', 'partial', 'failed')),
  stage          TEXT NOT NULL DEFAULT 'queued',
  started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at    TIMESTAMPTZ,
  posts_fetched  INT NOT NULL DEFAULT 0,
  posts_relevant INT NOT NULL DEFAULT 0,
  gemini_calls   INT NOT NULL DEFAULT 0,
  source_status  JSONB NOT NULL DEFAULT '{}'::jsonb,  -- per source: { ok, count, error, quotaRemaining }
  details        JSONB NOT NULL DEFAULT '{}'::jsonb,  -- stage timings, dropped counts, warnings
  error          TEXT
);

CREATE TABLE IF NOT EXISTS posts (
  id                  SERIAL PRIMARY KEY,
  source              TEXT NOT NULL,      -- 'hackernews' | 'stackoverflow' | 'github' | 'devto'
  external_id         TEXT NOT NULL,
  url                 TEXT NOT NULL,
  title               TEXT NOT NULL,
  body_excerpt        TEXT NOT NULL DEFAULT '',
  author_handle       TEXT,               -- shown in the UI only; never sent to Gemini
  created_at_source   TIMESTAMPTZ NOT NULL,
  score               INT NOT NULL DEFAULT 0,
  comment_count       INT NOT NULL DEFAULT 0,
  answer_count        INT,
  is_answered         BOOLEAN,
  has_accepted_answer BOOLEAN,
  view_count          INT,
  state               TEXT,               -- GitHub: 'open' | 'closed'
  raw_tags            TEXT[] NOT NULL DEFAULT '{}',
  fetched_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);

CREATE TABLE IF NOT EXISTS post_tags (
  id                SERIAL PRIMARY KEY,
  post_id           INT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  run_id            INT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  relevant          BOOLEAN NOT NULL,
  topic_id          INT REFERENCES topics(id),
  pain_point        TEXT NOT NULL DEFAULT '',
  unresolved_signal BOOLEAN NOT NULL DEFAULT FALSE,
  objection_id      INT REFERENCES sales_objections(id),
  confidence        REAL NOT NULL,
  UNIQUE (post_id, run_id)
);

CREATE TABLE IF NOT EXISTS weekly_snapshots (
  id               SERIAL PRIMARY KEY,
  week_start       DATE NOT NULL,          -- IST calendar date the 7-day window starts on
  topic_id         INT NOT NULL REFERENCES topics(id),
  mention_count    INT NOT NULL,
  engagement       INT NOT NULL,
  unresolved_count INT NOT NULL,
  resolved_count   INT NOT NULL,
  unresolved_share REAL,                   -- null when no post could be judged
  top_pain_points  JSONB NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (week_start, topic_id)
);

CREATE TABLE IF NOT EXISTS briefs (
  id               SERIAL PRIMARY KEY,
  week_start       DATE NOT NULL UNIQUE,
  run_id           INT REFERENCES runs(id) ON DELETE SET NULL,
  content          JSONB NOT NULL,         -- the full verified brief, self-contained for read-only history
  summary_markdown TEXT NOT NULL,          -- "Copy for Google Doc"
  email_status     TEXT NOT NULL DEFAULT 'not_sent',  -- 'not_sent' | 'sent' | 'failed: ...' | 'skipped: ...'
  emailed_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Indexes ----------

CREATE INDEX IF NOT EXISTS posts_created_at_source_idx ON posts (created_at_source);
CREATE INDEX IF NOT EXISTS post_tags_topic_id_idx ON post_tags (topic_id);
CREATE INDEX IF NOT EXISTS post_tags_run_id_idx ON post_tags (run_id);
CREATE INDEX IF NOT EXISTS weekly_snapshots_week_start_idx ON weekly_snapshots (week_start);
CREATE INDEX IF NOT EXISTS runs_started_at_idx ON runs (started_at DESC);

-- The "already running" lock: the database itself refuses a second row with status 'running'.
-- This is safe even if two people click "Run now" in the same millisecond.
CREATE UNIQUE INDEX IF NOT EXISTS runs_one_running ON runs (status) WHERE status = 'running';
