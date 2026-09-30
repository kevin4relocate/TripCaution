# TripCaution · Automated Gemini thumbnail pipeline (prelaunch technical spec)

## What is implemented
A signed-in owner imports a TripCaution JSON batch with **Automatically queue illustrations** enabled. Each new article lacking `hero_image_url` and carrying a meaningful `images.hero_prompt` receives one retryable D1 job. The import returns immediately and **preserves the article's requested status** (`published`, `scheduled`, or `review`). The article may briefly show a category fallback until the image job completes. The Cloudflare scheduled worker processes **at most two jobs every 15 minutes**, generates an article-specific 16:9 JPEG via the official Gemini Interactions API, uploads it securely into R2 and assigns the first generated URL only when the article still lacks an image. Existing images are not overwritten. This is *asynchronous*, not a promise of an image at the exact moment import returns.

Source files:
- `src/thumbnails.js` — image styling, provider request, R2 persistence, idempotent queue processing, 3-try capped retry.
- `migrations/0004_thumbnail_jobs.sql` — isolated D1 queue with attempt count, lease, next-attempt time and state.
- `src/index.js` — per-import enqueue, private admin status/backfill/retry, nonblocking Cron.
- `public/admin.html` and `public/admin.js` — import checkbox and progress controls.
- `tests/thumbnails.test.js` — stubbed generation and failure regression tests.

Image provider: Google Gemini Interactions API; default `gemini-3.1-flash-image` with `16:9`, `1K`, JPEG output. The response is validated before storage. Content is **editorial illustration**, never an actual photograph/evidence of an incident. The master research prompt provides article-specific scene descriptions and alt text; the backend adds consistent brand styling.

## Owner activation — NOT automatically activated by merging
Image generation is a separately billed API service. The feature is **OFF by default** and cannot work without an image API key and R2. Do not put secret keys in GitHub, JSON imports, article text, or chat.

1. Make a Cloudflare D1 backup. Apply the latest migration to the **remote** D1 database using your existing Wrangler authenticated deployment environment:
   `npx wrangler d1 migrations apply tripcaution-db --remote`
   Verify that `thumbnail_jobs` exists. The repository must deploy first.
2. Create an R2 bucket in your Cloudflare account, e.g. `tripcaution-media`. Add this binding to `wrangler.jsonc` **after** the bucket exists (it is intentionally not committed here because a missing bucket could break production deployment):
   ```json
   "r2_buckets": [
     {"binding": "MEDIA", "bucket_name": "tripcaution-media"}
   ]
   ```
   If an R2 MEDIA binding already exists in the deployed Worker, preserve it; never provision a second bucket accidentally. The existing `/media/editorial/<uuid>.webp` Worker route serves images, so a public R2 bucket domain is **not required**.
3. Set the private Cloudflare Worker secret (not a repository variable) named `GEMINI_API_KEY`. The owner may use Cloudflare Dashboard → Worker → Settings → Variables and Secrets → Add Secret. Ensure the Google AI Studio project tied to that key has Gemini image-generation access and appropriate billing/quota controls.
4. After migration + binding + secret all work, set `THUMBNAIL_AUTOGEN_ENABLED=true` and redeploy. `wrangler.jsonc` now persists the `MEDIA` R2 binding and defaults `THUMBNAIL_MODEL` to `gemini-3.1-flash-image`. A production job runs only with **all** requirements: flag, D1, MEDIA binding and API secret.
5. In Admin → Import Content, ensure the thumbnail checkbox is selected. Import a **single private Review test article**, then check **Thumbnail queue**; the first Cron runs within 15 minutes. Check the image on the public card **only after** approving test publication. Confirm R2 storage, D1 `hero_image_url`, alt text and no errors before importing 88 articles.
6. To populate images for **previously imported** articles with saved prompts, use **Create thumbnails for existing articles** (30 per button press). Repeat after processing, as appropriate. It will not replace existing URLs or generate images for articles lacking meaningful `hero_prompt`. The owner-only Retry endpoint is for a failed missing-image job.
7. If the API exceeds cost limits, disable `THUMBNAIL_AUTOGEN_ENABLED` and redeploy. Imported content remains intact, and queue state persists. Re-enable after reviewing spend. Three failed attempts end in `failed`, never a silent unlimited retry.

## Expectations and limitations
- **Import performance**: images are queued *after* successful article writes; no AI calls happen in the import HTTP request. Status and date are not altered by image generation.
- **Throughput**: at most 2 generation requests per 15-minute Cron (~8/hour) subject to provider latency, Cloudflare limits, quota and retries. A batch of 88 is **approximately 11 hours at theoretical maximum**, not an SLA.
- **Safety**: no invented evidence graphics; illustrations are informational. User/owner-reviewed content can be published while its image is pending, with the existing fallback. Serious topics should use a restrained neutral prompt.
- **Security**: Gemini secret never appears in responses, only private editor can backfill/retry, public consumers can only GET media via the existing restrictive media route. Generated JPEG is validated and limited to 5 MB.
- **Operational risk**: generating from an untrusted imported prompt sends that text to the chosen image API. Only import content you have checked locally. No auto-image job can authorize article publication.
- **No fake success**: GitHub CI pass means code validation, not a live generated image. A production end-to-end image check is still required once the user configures a paid account and R2.
