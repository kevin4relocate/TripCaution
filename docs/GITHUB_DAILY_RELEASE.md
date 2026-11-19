# TripCaution: one GitHub-released article each day

## Final publication architecture

- Existing 110 published guides remain in Cloudflare D1, unchanged.
- The next 400 guides are stored as four 100-article JSON batches under `content/`. Batch 004 begins 16 September 2027, directly after Batch 003, and ends 24 December 2027.
- GitHub Actions `github-daily-release.yml` runs every day at **01:00 UTC = 08:00 Vietnam time (UTC+7)**. GitHub schedule execution can start later than the nominal time.
- The action executes `scripts/release-daily-article.mjs` and selects at most one not-yet-released article whose `planned_publish_at` is due. An execution on the same Vietnam calendar day cannot publish a second guide. If a day is missed, the next job can release only the oldest overdue article, never more than one.
- Before writing any release artifact, it performs an HTTP/HTTPS GET on the **two pre-existing R2 WebP paths** (hero and inline) through the live Worker media route, checking status, content type and WebP bytes. The job **does not upload, rename, or overwrite images**.
- If either image is missing, the workflow fails without committing an article. The next day's run retries the oldest missing guide, instead of releasing an article with broken images.
- When both images exist, it commits `public/releases/articles/<slug>.json`, `content/github-release-log.json`, and `src/github-release-index.js` directly onto `main`. Only that day's article is added; future unreleased draft content is not copied into public assets.
- Cloudflare's **Git integration** must be set to auto-deploy commits to `main`. Cloudflare deploys the latest commit; GitHub Actions does **not** invoke Wrangler daily and does not need Cloudflare credentials.
- The Worker serves the released article from `ASSETS` and exposes it at `/guides/<slug>` using the existing public article layout, hero/inline media from R2, source list, TOC, canonical/OG/Article schema, share link, and related guide cards. The index is combined with published D1 guides in home, destination hubs, caution hubs, search, and `sitemap.xml`.
- The old Cloudflare `*/15 * * * *` Cron trigger has been removed from `wrangler.jsonc`.

## Media status and owner workflow

The owner confirms Batch 001 and 002 images (400 WebP files total) were already uploaded to R2. **No repeat upload is required.** Batch 003 and 004 images are separate owner-controlled steps. For each, upload the batch's 200 `Gen_001.webp`–`Gen_200.webp` into `Images/Batch-003` or `Images/Batch-004` and manually run that batch's `TripCaution batch 00N — upload images to R2` GitHub Action. The same input Gen numbers never imply the same R2 keys. The daily release checks for the real R2 objects automatically.

The repository has distinct 200-image manifests and manual-only upload workflows for Batches 003 and 004. Neither is modified by this feature. Each day releases one article using two corresponding images.

## Publishing safety and editorial transparency

- This release plan is **owner-directed by the fixed 400-day GitHub calendar**, not an AI writer producing unlimited articles. The 400 articles' original draft flags remain unchanged in the content source files; the public copy is explicitly labeled as research-first and not individually verified in the Dashboard.
- Editorial review of claim-level sources is still strongly recommended before each release; the automated image gate does not establish factual accuracy.
- The GitHub index contains only released entries. Each published article stores `review_approved: 0` and `source_mode: github-scheduled` so it cannot be misrepresented as a reviewed D1 record.
- Dates come from the original calendar starting 20 Nov 2026 and extending through 24 Dec 2027. Daily release timestamps reflect the job time, not an invented exact deployment time.
- No change to Cloudflare D1 production records or previously assigned R2 keys; Batch 004 adds its own manifest and upload workflow.

## How to verify

1. Confirm Cloudflare has auto-build/deploy enabled for the GitHub `main` branch. This setting is external to the repository.
2. Confirm `TRIPCAUTION_API_URL` GitHub Actions variable points at the active Worker; otherwise workflow uses `https://tripcaution.nghiep4tube.workers.dev`. This origin is used solely to check the two R2 WebP objects.
3. Run `node --test tests/github-release.test.js` and `node scripts/release-daily-article.mjs --dry-run`. Before the due date, dry-run reports no due release.
4. Check `/guides/<slug>`, `/media/editorial/<slug>.webp`, `/media/editorial/<slug>-inline-01.webp`, homepage and sitemap after Cloudflare deploy.
5. If GitHub branch protections prevent `GITHUB_TOKEN` pushes to `main`, configure the permitted bot or GitHub App push flow. Do not disable protected-branch security merely to work around a failed release.

**Important:** GitHub scheduled workflows run at approximately the requested time, not at an exact guaranteed second. Cloudflare deploy also takes additional time. If image checks, the GitHub push or Cloudflare auto-deploy fails, the guide should not be described as live merely because its calendar date arrived.
