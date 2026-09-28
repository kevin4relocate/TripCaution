# TripCaution ✳
**Know before you go.** Source-grounded travel precautions, country/city guides, and an admin-controlled editorial workflow.

TripCaution is a Cloudflare Workers application with a GitHub Actions/Gemini research pipeline. It is intentionally **not** a fabricated personal-review site. Automated articles must cite supporting research; sensitive content stays in the human review queue.

## What's included

| Area | Implementation |
|---|---|
| Public website | Responsive editorial homepage, destinations, guides, search, SEO metadata, XML sitemap |
| Content management | Private single-key admin login, signed session cookie, article editor, source editing, status changes, search and filters |
| Import | Upload/paste research JSON; owner can explicitly replace matching articles, which immediately return to private Review |
| Editorial calendar | Human-controlled publishing and individually approved scheduling; hourly Cron publishes only approved records |
| Automatic publishing | Hourly Cloudflare Cron publishes previously approved scheduled records |
| AI research | Scheduled GitHub Actions reads curated official-source pages then uses Gemini text generation; optionally supports Google Search grounding. **At most one new research article per run** |
| Database | Cloudflare D1 migrations |
| Illustration workflow | Gemini-generated watercolor *prompts*, manual illustration URLs, optional R2 image upload |
| Safety | 12-hour HMAC-signed HttpOnly/Secure admin cookie, D1 login throttling, same-origin mutation checks, separate bot token, source gate, manual review and audit log |
| SEO | Per-article titles, meta descriptions, canonical, social metadata, dynamic sitemap, source lists |

**Important current limitations:** Gemini-generated artwork is *not automatically rendered* by the free daily job. It creates a ready-to-use hand-painted watercolor prompt. Image generation APIs may cost money or require separate quotas. Import finished illustrations yourself with R2, when configured. Source URLs still need human verification: grounding and link matching are safeguards, not proof that every assertion is true.

## 1. Before you deploy

You need your own Cloudflare account, GitHub access to `kevin4relocate/TripCaution`, and (only if using the automatic writer) a Google AI Studio Gemini API key.

The GitHub repo is public. **Never put API keys, email credentials, token values, .dev.vars or Cloudflare credentials in source files or PRs.**

### Install locally (optional)

```bash
git clone https://github.com/kevin4relocate/TripCaution.git
cd TripCaution
npm install
npm test
npm run check
```

## 2. Create the D1 database

In Cloudflare, open **Workers & Pages > D1 SQL Database** and create a database called `tripcaution-db`. Alternatively use your terminal:

```bash
npx wrangler login
npx wrangler d1 create tripcaution-db --location apac
```

Copy the returned **database ID**. Replace only the placeholder `REPLACE_WITH_REAL_D1_DATABASE_ID` in `wrangler.jsonc`; commit and push that non-secret identifier to GitHub.

Run database migrations **against the remote database**:

```bash
npx wrangler d1 migrations apply tripcaution-db --remote
```

The migration creates `articles`, `categories`, `automation_runs`, `audit_logs` and other support tables. You only need to apply it once per database, then apply subsequent migrations as provided.

## 3. Connect GitHub to Cloudflare Workers

This project is a **Cloudflare Worker with bundled static assets**, not a Pages-only static site.

In **Cloudflare dashboard > Workers & Pages > Create application**, choose a Worker with Git integration / **Import a repository**. Connect your GitHub account, authorize access to `kevin4relocate/TripCaution`, and select its `main` branch.

Set:
- **Project/Worker name:** `tripcaution`
- **Root directory:** repository root (`/`)
- **Build command:** `npm install && npm run check` (when the wizard requests it)
- **Deploy command:** `npx wrangler deploy`
- **Production branch:** `main`

Some current Cloudflare screens configure build/deploy automatically from `wrangler.jsonc`. Follow the Worker build integration if the exact labels differ. Do not create a plain static Pages deployment because the site needs the Worker and D1 binding.

**If Git deploy fails with a D1 binding error,** finish step 2, commit the database ID, and retry deployment. Confirm the generated `*.workers.dev` URL loads. Before connecting a domain, set `SITE_URL` in `wrangler.jsonc` to that actual `https://<worker>.<account>.workers.dev` URL so staging canonical tags and sitemap are accurate.

## 4. Secure the editorial dashboard with one private key (mandatory)

The public website remains open. The editor lives at `/admin` and **will not open without a configured private key**. A successful login creates a 12-hour, HMAC-signed, Secure, HttpOnly, SameSite=Strict cookie. Admin APIs check that cookie and reject cross-origin write requests. Incorrect login attempts are throttled using the existing D1 `audit_logs` table (six unsuccessful attempts per IP in 15 minutes; IP addresses are keyed-hashed before logging). D1 must be initialized before logging in.

**Set your key privately — never in GitHub, chat, a `wrangler.jsonc` variable, or client-side JavaScript:**

1. Generate a cryptographically random secret of **at least 32 characters**. On macOS Terminal, for example, run `openssl rand -hex 32` to create a 64-character random key, and store it in your password manager. You may use your own high-entropy 32+ character key.
2. In **Cloudflare > Workers & Pages > tripcaution > Settings > Variables and Secrets (Production) > Add variable**, select **Secret**, set the name to `ADMIN_LOGIN_KEY`, paste the key as its value, and choose **Deploy** when prompted. Confirm that Cloudflare shows the type as **Secret**, not plaintext Variable.
3. Allow the latest commit to deploy through GitHub integration. Visit **`/sign-in`** (the new login path) and confirm the key-entry form loads. It is intentionally outside the former Access-protected `/admin*` path.
4. **If the old Cloudflare Zero Trust app is still active**, it can intercept `/admin` and cause the previous login redirect loop even when the new key system works. **Only after confirming `ADMIN_LOGIN_KEY` is deployed and `/sign-in` loads**, go to Zero Trust > Access controls > Applications and delete the *old TripCaution Access application* or remove all of its TripCaution destination paths. Do not delete the Worker or its D1 database. This is the only Cloudflare Access cleanup required for this simple login.
5. Visit **`/admin`** in a fresh private browser window. It should display the new key-entry page. Enter the key to reach the editor. Test `/api/admin/articles` without signing in: it must return HTTP 401. Use the new **Sign out** button when finished.

The key is stored encrypted on Cloudflare; it is never returned to the browser or built into source code. A stolen signed session remains usable until its 12-hour expiry even after browser sign-out; **changing `ADMIN_LOGIN_KEY` on the Worker revokes all previously issued sessions**. Use a unique, random key and protect your password manager. The rate limiter is additional protection against guesses, not a substitute for high-entropy credentials.

The bot's `/api/ingest` continues to use a separate `INGEST_TOKEN` Bearer secret. Never reuse your admin key as the bot token. **All bot articles always enter Review**, including `before-you-go` and `etiquette`. Bot tokens cannot approve or publish.

### Review and preview an imported guide

Open `/admin` after signing in. In **All articles**, select **Review** (or **Edit** for other statuses), then use the one **Preview saved article** button inside the editor to see the last saved version in the public-site layout. Published articles instead have a small **View live** text link in the list. This preview is private: only holders of a valid editor session can open `/admin/preview/<article-uuid>`, which has noindex and no-store protections. It does not publish an article.

Select **Review** to inspect the saved draft, source links and optional research timestamp. There are no compulsory checkboxes or written claim–source notes: after reviewing the article, choose **Publish now** or **Schedule**. A clear confirmation asks you to affirm that you have reviewed it. The owner-confirmed decision, time, method (single/bulk) and a default 30-day recheck date are saved in D1 `audit_logs`. This record documents your publishing decision; it does **not** claim that every source was independently fact-checked. A guide still needs at least one valid HTTPS source.

If you edit the article or upload a new image, **Save changes** before publishing. Previously published or scheduled articles that have been edited return to private Review. In **All articles**, tick individual rows or **Select all visible** (search/filter applies). The compact bar keeps **Publish, Hide, Schedule** visible; **More** contains **Restore, Move to Deleted** and, under the **Deleted** filter only, the guarded permanent-deletion tools. For a schedule batch, choose a start time and optionally space successful articles 24 hours apart. An explicit confirmation is still required; incompatible articles and missing sources are skipped and reported. **Hide is private, Delete is recoverable**, and Restore moves to draft rather than automatically republishing. To free D1 storage, select the **Deleted** filter: use **Delete permanently** for individually selected deleted articles or **Empty Trash** for *all* deleted articles, including any outside the first 300 rows displayed in Admin. Both irreversible actions require typing `PERMANENTLY DELETE` and confirming the current count. They remove the articles and their associated per-article audit entries transactionally while recording an aggregate purge event. **Export a D1 backup first**; R2 image files and independent `content_topics` / `automation_runs` remain unchanged. For a full database reset, do not use this UI—perform a separate backed-up D1 migration/reset with a maintenance window.

### Sprint 0: editorial contact, robots, research-only imports and revisions

**Public correction email is a deliberate owner decision.** In **Cloudflare > Workers & Pages > tripcaution > Settings > Variables and Secrets > Production**, add a **plaintext Variable** named `EDITORIAL_CONTACT_EMAIL` containing a dedicated editorial address that you consent to display publicly. Use a different address from your private login when possible. Save/deploy the updated Worker settings. Send a real test email and confirm receipt, then add `EDITORIAL_CONTACT_VERIFIED=true` as a second plaintext Production Variable. Until both are present, TripCaution does not display the address and Contact remains noindex. Never add your password or private `ADMIN_LOGIN_KEY` to this variable. The Contact page remains flagged as pre-launch/noindex until this address is set. About, Privacy and Contact disclose actual current practices, including externally loaded Google Fonts; update the policy BEFORE enabling trackers or ads.

`/robots.txt` is served dynamically from `SITE_URL` (the same host used for canonicals and sitemap). The outdated static robots file referencing a different domain was removed. If you later change the public domain, set `SITE_URL` first and verify the dynamic robots, canonical and sitemap again.

**Applying the three revised starter articles to existing production D1 is NOT automatic when GitHub deploys.** The curated corrections are in `content/starter-guides.json`. **Make a D1 backup first.** In Admin > Import content, download that revised JSON from GitHub, enable **Apply corrections to matching existing slugs**, confirm the withdrawal warning and import. Existing matching public articles are **immediately withdrawn to Review**, preserving their article IDs; inspect each updated draft and its source links, open the private preview and explicitly confirm publication. You may also select and publish several articles together **only after actually reviewing every selected article**. If an article is insufficiently supported, leave it unpublished. Ingestion tokens cannot enable revision mode.

**Production verification** must still be done by the owner. Run the manual GitHub workflow `TripCaution production smoke` (once it is installed), then confirm the actual Cloudflare Deployment SHA, mobile Safari/Chrome, private review access, backup/restore and email receipt. CI mocks and a successful GitHub run are not replacements for those checks.

## 5. Configure custom domain

After a successful `workers.dev` launch:

1. Add your owned domain to Cloudflare and complete DNS/nameserver setup.
2. Under **Workers & Pages > tripcaution > Settings > Domains & Routes**, attach the domain as a **Custom Domain**.
3. Update `SITE_URL` in `wrangler.jsonc` to the exact live `https://...` URL, commit and push.
4. The built-in key login works on the custom domain as well. Test `/admin` and the `/api/admin/*` endpoints there too. Any leftover Access application protecting those paths must be removed or it can intercept the key-login flow.
5. Check `/robots.txt`, `/sitemap.xml`, a destination page and an article page.

The site can run without a purchased custom domain during testing.

## 6. Optional R2 media uploads

The initial deploy deliberately **does not require R2**. This avoids forcing new accounts to enable R2/billing before the site can launch.

To activate upload in the admin:
1. Create an R2 bucket named `tripcaution-media`.
2. Add this object to `wrangler.jsonc` (top-level, alongside `d1_databases`):
   `"r2_buckets": [{"binding":"MEDIA","bucket_name":"tripcaution-media"}],`
3. Commit and deploy again.

Use **Editorial Desk > Edit article > Upload an image**. The Worker accepts JPEG, PNG and WebP up to 5 MB, validates basic file signatures, stores unpredictable object keys, and serves them through `/media/editorial/...`. R2 may have eligibility/billing prerequisites even if usage is within its free allowance.

If R2 isn't enabled yet, you can still import external HTTPS editorial image URLs.

## 7. Set up GitHub Actions daily Gemini research

Open GitHub repository **Settings > Secrets and variables > Actions**.

Create **Repository secrets**:
- `GEMINI_API_KEY` = your own API key created in Google AI Studio.
- `TRIPCAUTION_INGEST_TOKEN` = a strong random value of **at least 32 characters**. Generate with a password manager or cryptographically secure random generator.

Create **Repository variables**:
- `TRIPCAUTION_API_URL` = the deployed site's HTTPS origin **without a final slash**.
- `GEMINI_MODEL` = an available text model (defaults to `gemini-3.5-flash-lite`; confirm free-tier quota in your Google project).
- `TRIPCAUTION_RESEARCH_MODE` = `curated` (default, uses official pages in `automation/sources.json` without search-grounding charges) or `grounded` (opt-in, only when your key/model supports Search grounding and its pricing).
- `TRIPCAUTION_AUTOMATION_ENABLED` = `true` **only after your Cloudflare site, D1 database, ingest secret and model quotas have been configured and tested**. The scheduled workflow deliberately skips its job until this variable is set.

Put the **same** ingestion secret on the Worker, **not in Git**. Use **Workers & Pages > tripcaution > Settings > Variables and Secrets > Add** `INGEST_TOKEN` as an encrypted **secret**, then deploy or save settings as Cloudflare requests.

The workflow in `.github/workflows/daily-content.yml` runs at **18:17 UTC**, approximately **02:17 Singapore time the following day**. Scheduled GitHub Actions are best-effort and can be delayed or skipped; you can also start it manually from **Actions > TripCaution daily research > Run workflow**.

A run:
- Checks recently published/scheduled titles so it can avoid obvious duplicates.
- Skips writing when there are already at least 2 articles scheduled for the next 2 days.
- Fetches current HTML from two configured official government advice pages and asks Gemini to analyze the retrieved content, unless you explicitly opt into Gemini Search grounding.
- Writes one candidate article, checks cited links against the fetched/grounded source list and applies basic quality rules.
- Imports it via authenticated `/api/ingest`.
- **Every** article enters the private Review queue. No topic category, source count or AI timestamp permits automatic public publication.
- Logs an error instead of publishing fabricated or unsupported material when research is insufficient.

**No API cost guarantee:** default curated mode uses government public pages and free-tier Gemini *text* when available. Most current Gemini 3.x models do **not** include Search grounding in the free API tier; image-generation APIs generally are not free. Research skips publication if fewer than two official pages can be read. Model access, page availability, billing and quotas can change. Verify all service terms before enabling a paid feature.

## 8. Manual Pro research import and daily calendar

Your separate Pro AI research should export the **TripCaution v1 JSON package** defined in [MASTER_PROMPT.md](MASTER_PROMPT.md).

Workflow:
1. Run the master research prompt with current browsing and request 1–30 article packages.
2. Open `/admin` > **Import content**. Paste JSON or upload the `.json` file.
3. A package's research references and preferred date are stored; imported articles are held in **Review** (never silently auto-published).
4. Open an article to edit its title, body, category, source URLs, metadata, hero illustration prompt or image.
5. **Approve & publish** immediately or **Approve & schedule** for a specific time in your browser's local time.
6. If editing an already published guide, save it; it returns to private Review until you verify and reapprove the changed content. Scheduling also requires the recorded review.
7. The hourly Cloudflare Cron publishes approved scheduled articles whose timestamp has arrived, independent of whether GitHub is running.

Manual import does not require Gemini API usage. Importing one file with 20 articles does **not** trigger 20 simultaneous posts.

## 9. Editorial and legal safeguards

- **Never impersonate personal travel experience.** Editorial writing can be conversational without claiming the author stayed at a hotel, ate at a restaurant, witnessed a scam, or visited a city.
- **Never use AI illustrations as evidence.** Use the caption provided on guide pages. Hand-drawn watercolor art is ideal for explanatory imagery.
- Check source claims manually when publishing allegations, health/safety/visa advice, crime numbers or laws.
- Do not scrape and permanently store Google Maps reviews or pictures without applicable rights.
- An imported source URL isn't automatically verified merely because a language model supplied it.
- Configure an actual editorial inbox via `EDITORIAL_CONTACT_EMAIL` and **test receiving a real correction email before launch**. Until then, the Contact page explicitly reports that the inbox is not configured and is marked noindex.
- Configure any applicable consent and privacy disclosures **before adding advertising or analytics**. No ads or affiliate trackers are installed by default.

## 10. Validation and troubleshooting

```bash
npm install
npm run check
npm test
python -m py_compile automation/daily.py
npx wrangler d1 migrations apply tripcaution-db --local
npx wrangler dev
```

Go to `/admin`: without a signed key session, the editor should redirect to `/sign-in`. An admin key shorter than 32 characters will not work. Public pages can load on an empty local DB.

For reversible removal, use **Hide**, **Move to Deleted**, then **Restore draft** as needed. **Permanent deletion** is a distinct, owner-confirmed action under the Deleted filter; create a private D1 export first. R2 images are not deleted by the D1 purge. The admin's batch JSON import reports accepted and rejected articles individually.

### Production readiness checklist

- [ ] D1 remote migrations applied
- [ ] Workers Git deployment succeeded
- [ ] `SITE_URL` matches your live domain
- [ ] `ADMIN_LOGIN_KEY` is stored as a production Secret, `INGEST_TOKEN` is different and the old Access redirect app no longer intercepts admin routes
- [ ] Signed-out admin/API requests are denied
- [ ] Valid article imported, reviewed, published, and visible
- [ ] Scheduled article actually published by hourly Cron
- [ ] Sitemap and search operate on live DB
- [ ] At least one Gemini workflow tested manually and its actual usage checked
- [ ] Actual editorial contact and updated legal/privacy information published
- [ ] Optional R2 uploads verified with a real test image

## Sprint 2 — Content, SEO & reader experience

Live guides now include safe anchored headings and a responsive **In this guide** outline, related links to already-published articles, honest Article/Breadcrumb structured metadata, semantic accessibility links and a correctly dated sitemap. Search distinguishes published destinations from countries still under research. Private previews remain non-indexed and never receive public Article schema.

An optional **THE QUICK TAKE** sidebar appears **only** if you explicitly write a `## Key takeaways` heading with two to five bullet points in the article body. No AI summary is displayed without editorial writing. In Admin, SEO title, description and slug now update a small, non-blocking search snippet preview.

For topic briefs, the review checklist and how to use these features, see [Sprint 2 editorial roadmap](docs/SPRINT2_EDITORIAL_ROADMAP.md) and [Sprint 2 implementation notes](docs/SPRINT2_IMPLEMENTATION.md). Run `npm run audit:content` for editorial-package formatting and metadata hygiene; it does **not** verify the accuracy of travel advice. Publishing, source review, live-mailbox verification and raster social-card production remain owner responsibilities.
