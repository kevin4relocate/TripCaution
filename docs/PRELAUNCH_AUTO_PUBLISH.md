# TripCaution prelaunch research and evidence-gated publication

## What the software now supports

- One daily GitHub Actions run targets **1–3 successful article records** and may inspect additional distinct country/topic slots within a bounded attempt budget when earlier evidence is weak. The server independently enforces an absolute **maximum of three unattended publications per UTC day** using unique slots in the existing D1 `automation_runs` table. An unsuccessful research request never guarantees a publication.
- Southeast Asia is first: eleven countries, three first-pass briefs each (**33 research opportunities**) and, after explicit expansion to phase 2, eight per country (**88 total potential briefs**, subject to actual supporting evidence).
- Dated Reddit first-hand reports can be collected as **research leads**, including experiences operators or media have not described. Community anecdotes are clearly attributed, never treated as representative frequency, and community-only source packages stay in owner Review.
- A low-stakes unattended article needs two cited independent websites; at least two claim-to-source rows with precise scope and literal evidence excerpts; live HTTPS retrieval and quote matching in the research job; an allowed category; no conflicting evidence or high-stakes keywords. Failure means **private Review**, not a fabricated public warning.
- Legal, immigration, medical, serious safety issues and named accusations cannot be unattended publications. Myanmar remains owner-reviewed. Automated publications never receive an unreviewed impact rating.
- Automated articles are published with `review_approved=0`, openly marked **Automated research · Not yet editor-reviewed**. The owner can filter **Published · Not Reviewed**, inspect retained exact evidence excerpts and mark reviewed after checking. Automated checks are not human fact-checking.
- If there are already 36 unreviewed public articles or 40 private research drafts, the job pauses and asks for owner attention.

## Explicit two-sided activation

No secret should ever be committed. These steps require the owner to configure their accounts:

1. Deploy the tested branch after merge, including the `wrangler.jsonc` variable `AUTO_PUBLISH_ENABLED=true`. Confirm the remote D1 database already has all repository migrations applied. This feature adds **no new D1 migration**.
2. In GitHub Actions repository **Variables**, configure:
   - `TRIPCAUTION_AUTOMATION_ENABLED=true` (enables the existing job)
   - `TRIPCAUTION_AUTO_PUBLISH_ENABLED=false` only if you want to opt out. The prelaunch workflow now defaults to requesting evidence-gated unattended posts, while Cloudflare's independent `AUTO_PUBLISH_ENABLED` server gate must also be true.
   - `TRIPCAUTION_DAILY_TARGET=3` (allowed values 1–3; default 3 when auto publication is enabled)
   - `TRIPCAUTION_CONTENT_PHASE=1` until the first pass is filled, then explicitly switch to `2`
   - `TRIPCAUTION_RESEARCH_MODE=grounded` if supported by the configured Gemini key, or `curated` for documented live government pages
   - `TRIPCAUTION_COMMUNITY_RESEARCH=false` only if you want to opt out. Prelaunch research defaults to an additional grounded Reddit lead search when grounded mode is available; community reports remain attributed leads and cannot alone qualify an unattended warning. This uses extra model/search quota.
   - `TRIPCAUTION_API_URL` set to the *currently deployed* Worker origin.
3. Configure GitHub **Secrets** `GEMINI_API_KEY` and `TRIPCAUTION_INGEST_TOKEN`. Set exactly the same ingest token as Cloudflare's secret `INGEST_TOKEN`; keep all tokens off the public repository.
4. In GitHub Actions, manually trigger **TripCaution daily research** once, inspect its logs and the Dashboard's new **Published · Not Reviewed** records. Verify generated sources yourself before trusting changes to travel rules.
5. After several days, inspect how many safe articles were actually published versus how many sensitive briefs entered private Review. Review those drafts individually; never automatically publish them to inflate article counts.

## Prelaunch quality targets (not fictional inventory)

Use **at least 33 genuinely useful published guides** spanning **all 11 Southeast Asian countries**, with at least three published guides per country, as the initial *editorial planning target*, not an automated guarantee. The private Dashboard now tracks this inventory directly and shows the remaining count plus the minimum number of perfect 3-publication days. Each must solve a distinct, specific travel question, link to sources that directly substantiate material claims, state relevant location and date, and avoid repetitive generic advice. Only record verified, genuinely existing content in launch progress; drafts, 404s, planned country pages and duplicate topics do not count. Expand phase 2 and other regions once the first-pass research and review workload is under control. A realistic 3/day maximum needs **at least 11 days** for 33 new publications even with perfect success, and human review is still necessary for higher-stakes topics.

Check the public site on mobile; test article source links and dates, paid travel claims and contact mail delivery, run `scripts/smoke-production.mjs`, confirm D1 backup and rehearsed **staging-only** restore, and confirm the deployed Cloudflare version matches the intended tested commit before launch.

## Stop / rollback

Disable GitHub variable `TRIPCAUTION_AUTO_PUBLISH_ENABLED` to keep daily research as private drafts; disable `TRIPCAUTION_AUTOMATION_ENABLED` to stop the writer entirely. Set `AUTO_PUBLISH_ENABLED=false` and deploy to independently close the server auto-publication gate. Existing public articles remain visible until the owner hides them; the dashboard shows their owner-review status.


## Owner-authored bulk import: publish, schedule, or review directly

When you locally review a ChatGPT Pro export, assign each article one of these statuses in `publishing.requested_status`:

- `"published"`: immediately publish when the signed-in owner imports the JSON.
- `"scheduled"`: import into the scheduled queue using `publishing.preferred_publish_at` with a future ISO 8601 timestamp and timezone (example: `"2030-06-01T09:00:00+07:00"`). The existing hourly Cloudflare Cron will publish it when due.
- `"review"`: keep private in the normal editorial review queue.

In Admin > Import content, the **Respect JSON status** checkbox is enabled by default. After one batch confirmation, each new article follows its status. This is owner-directed ingestion, not a bot capability. At least one valid HTTPS source and a future date for scheduled posts remain mandatory. Incorrect dates or invalid source metadata cause item-level errors instead of silent publication. Articles imported as Published or Scheduled without a review action in the dashboard retain `review_approved=0` and are disclosed as **Not Reviewed in Dashboard** until the owner marks them there. This flag does not indicate whether the owner reviewed locally; it avoids creating a false in-app review audit. AI files cannot invoke this behavior through the bot token. Existing article revisions always return to private Review, and the revision-import checkbox cannot be combined with direct publication. These controls do not bypass the separate safety rules for unattended daily auto-publication.
