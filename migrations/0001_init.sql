CREATE TABLE IF NOT EXISTS categories (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE
);
INSERT OR IGNORE INTO categories (id,name,slug) VALUES
 ('things-to-avoid','Things to Avoid','things-to-avoid'),
 ('tourist-traps','Tourist Traps','tourist-traps'),
 ('transport','Transport Cautions','transport'),
 ('food','Food & Drink','food'),
 ('local-laws','Local Laws','local-laws'),
 ('etiquette','Culture & Etiquette','etiquette'),
 ('before-you-go','Before You Go','before-you-go');
CREATE TABLE IF NOT EXISTS articles (
 id TEXT PRIMARY KEY,
 title TEXT NOT NULL,
 slug TEXT NOT NULL UNIQUE,
 excerpt TEXT NOT NULL DEFAULT '',
 content_markdown TEXT NOT NULL DEFAULT '',
 country TEXT NOT NULL DEFAULT '',
 city TEXT,
 category_id TEXT REFERENCES categories(id),
 tags_json TEXT NOT NULL DEFAULT '[]',
 sources_json TEXT NOT NULL DEFAULT '[]',
 uncertainties_json TEXT NOT NULL DEFAULT '[]',
 seo_title TEXT NOT NULL DEFAULT '',
 seo_description TEXT NOT NULL DEFAULT '',
 hero_image_url TEXT,
 hero_prompt TEXT,
 hero_alt TEXT,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','review','scheduled','published','hidden','archived','deleted')),
 source_mode TEXT NOT NULL DEFAULT 'manual',
 review_approved INTEGER NOT NULL DEFAULT 0,
 verified_at TEXT,
 published_at TEXT,
 scheduled_at TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_articles_status_scheduled ON articles(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_articles_country_city ON articles(country,city);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category_id);
CREATE TABLE IF NOT EXISTS content_topics (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, country TEXT NOT NULL, city TEXT,
 category TEXT, status TEXT NOT NULL DEFAULT 'queued', created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS automation_runs (
 id TEXT PRIMARY KEY, run_date TEXT NOT NULL, source TEXT NOT NULL,
 state TEXT NOT NULL, details TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')),
 UNIQUE(run_date, source)
);
CREATE TABLE IF NOT EXISTS audit_logs (
 id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, article_id TEXT, details TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
