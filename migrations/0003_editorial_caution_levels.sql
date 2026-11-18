-- Sprint 5: a per-article, human-assessed severity for one documented situation.
-- Existing live guides remain unassessed, never automatically labeled dangerous.
ALTER TABLE articles ADD COLUMN caution_level TEXT NOT NULL DEFAULT 'unassessed'
 CHECK(caution_level IN ('unassessed','low','moderate','high','critical'));
ALTER TABLE articles ADD COLUMN severity_scope TEXT NOT NULL DEFAULT '';
ALTER TABLE articles ADD COLUMN severity_rationale TEXT NOT NULL DEFAULT '';
-- No existing article is rewritten, and no article is automatically published.
