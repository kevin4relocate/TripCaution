# Seven-country Southeast Asia coverage pack

**Purpose:** Seven specific, source-linked private-review manuscripts for the seven destinations missing from the last measured live coverage snapshot. They are **not** live posts or substitutes for today's travel advisory. Published status must only come from Cloudflare D1, never the Git repository.

Research drafting reference date: 29 September 2026. Manuscripts: **Brunei (cash/card and Dart), Cambodia (KTI airport and bus), Indonesia (Bali ATM/card safety), Laos (motorbike rentals), Malaysia (KLIA rail), Myanmar (dated travel warnings), Philippines (ferry checks)**.

Every draft has at least two HTTPS research references, unique scope and 350+ words. The references are leads for your own checking, not an assertion that a human editor has verified the article. The Myanmar article requires individual, fresh review of official warnings and must never be unattended.

## Seed without accidentally publishing

1. Ensure current GitHub `main` has been deployed to the Worker and `INGEST_TOKEN` is configured in Cloudflare.
2. Set GitHub Actions **Variables** `TRIPCAUTION_API_URL` to the actual live Worker URL. Set **Secret** `TRIPCAUTION_INGEST_TOKEN` to the same private token as Cloudflare. Never commit the token.
3. In GitHub Actions, manually run **Import seven Southeast Asia research briefs** on `main`. Enter the exact confirmation `IMPORT`. It validates the manuscripts and skips existing slugs. This **only creates private REVIEW drafts**.
4. In /admin, filter **Review**, read each guide, open its original sources and verify current facts, links and applicability. Inspect prelaunch content text for up-to-date fares, dates and operators, especially sensitive health/safety topics. Publish individually as you validate.
5. Check **Prelaunch content inventory** in the Dashboard. Only actual published records count. As a separate workflow, enable the evidence-gated daily researcher for up to three safe publications per UTC day. Keep its `Published · Not Reviewed` queue manageable.

The homepage now renders up to twelve actually published guides (3 featured + 9 additional), and all regional destination links activate only when real published content exists. Nothing from this pack is displayed until published.

**Known limitation:** Source links and editorial relevance can change. Publishing requires human review; these are manually curated seed manuscripts, not evidence-gated auto-publish packages.
