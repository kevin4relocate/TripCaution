-- Sprint 4: additive, reversible-in-effect taxonomy expansion.
-- No existing category IDs or article records are renamed or deleted.
-- Apply to production D1 before accepting articles using these new IDs.
INSERT OR IGNORE INTO categories (id,name,slug) VALUES
 ('scams-theft','Scams & Theft','scams-theft'),
 ('payments-money','Payments & Money','payments-money'),
 ('safety-health','Safety & Health','safety-health'),
 ('travel-essentials','Travel Essentials','travel-essentials');
