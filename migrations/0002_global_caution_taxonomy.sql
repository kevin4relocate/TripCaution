-- Sprint 4 additive caution categories. Existing articles retain their original IDs.
-- Apply to the target D1 database before switching Admin to the new taxonomy.
INSERT OR IGNORE INTO categories (id,name,slug) VALUES
 ('scams-theft','Scams & Theft','scams-theft'),
 ('payments-money','Payments & Money','payments-money'),
 ('transport-difficulties','Transport Difficulties','transport-difficulties'),
 ('laws-customs','Local Laws & Customs','laws-customs'),
 ('safety-health','Safety & Health','safety-health'),
 ('travel-essentials','Travel Essentials','travel-essentials');
