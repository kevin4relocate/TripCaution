-- Background thumbnail generation; safe no-op until owner configures R2 and API secret.
CREATE TABLE IF NOT EXISTS thumbnail_jobs (
 id TEXT NOT NULL UNIQUE,
 article_id TEXT NOT NULL PRIMARY KEY REFERENCES articles(id) ON DELETE CASCADE,
 state TEXT NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','processing','retry','ready','failed')),
 attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt_at TEXT,
 lease_until TEXT,
 last_error TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_thumbnail_jobs_ready ON thumbnail_jobs(state,next_attempt_at,created_at);
