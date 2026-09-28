# Sprint 1 — Production & Security Audit
Date: 28 September 2026  
Scope: public production smoke from GitHub-hosted runner, static application/configuration review, targeted regression tests, non-destructive hardening of Worker/CMS. Mobile and performance testing are intentionally NOT included yet.

## Evidence and important limitations

- Examined current GitHub default-branch Worker, owner-session authentication, content normalization, import/scheduling, permanent deletion, browser editor code, Wrangler bindings, D1 initial schema, GitHub workflows, existing tests and startup documentation.
- The initial Sprint 1 GitHub-hosted public run returned **9/10**: all tested public pages and private-route behavior passed, but `/api/ingest` returned HTTP **503**. Code review confirmed this is deliberate **fail-closed behavior when `INGEST_TOKEN` is absent**, not an authentication bypass. Updated the audit to treat a disabled ingest endpoint as secured but not available for automation.
- The subsequent Sprint 1 GitHub-hosted public run **36381010292** passed **10/10** automated checks. This validated the live origin **at the time of that run**, not a permanent health guarantee or the deployment of later hardening commits. It reported (a) no configured verified public contact address and (b) ingestion token absent/invalid so automated drafting was unavailable. It also leaves production owner login/logout, real email receipt, backup restore, latest SHA and actual-device testing as manual gates.
- The local container and web reader could not directly access the Workers.dev origin. Public production verification here is grounded in recorded GitHub-hosted smoke results, not a claimed independent live browser session.
- This is a targeted launch audit, **not a comprehensive penetration test**, source-code dependency audit, accessibility audit, legal opinion or external vulnerability scan. Test authorization is restricted to the user's own application, and automated production checks never try a real password or mutate content.

## Findings and remediation

| Priority | Finding | Resolution | Proof / remaining check |
|---|---|---|---|
| P0 | Article publish/schedule and audit insertion ran in separate DB writes, permitting an unaudited public state after a partial failure. | Replaced with atomic **D1 batch transaction** in `applyEditorialAction`. | Mock transactional-failure regression in `tests/preview-review.test.js`; verify approved test run and perform owner-only staging check. |
| P0 | Admin bulk action permitted 300 articles in one Worker request; 3+ D1 queries per article could exceed Cloudflare Free per-invocation query limits. | Limit API to **10 IDs/request**, automatically process larger selected sets in 10-item sequential requests. Maintain one owner confirmation and 24h spacing across successful schedule batches. | Unit tests cover per-request limit, partial results and sequential client chunking; actual 20–30 article dry run on staging still advised. |
| P0 | Hard-delete selected mode accepted 300 bound IDs even though D1 has a stricter per-query binding limit. | Limit API to **50 IDs/request** and split larger owner-confirmed selections into multiple safe transactions; `Empty Trash` remains a separate explicit all-trash action. | Unit tests reject oversized requests; perform backed-up staging trial before mass deletion. |
| P0 | A syntactically valid but non-existent public email address could mislead visitors and make a fake mailbox look launch-ready. | Public contact only becomes active when the actual inbox is configured **and** `EDITORIAL_CONTACT_VERIFIED=true`. Otherwise Contact displays a pre-launch message and remains noindex. | Code/unit test complete; **real incoming + outgoing email test is owner-only and still pending**. |
| P1 | Public HTML lacked a consistent anti-frame and restrictive script policy; public share button used inline JavaScript. | Add CSP, X-Frame-Options, Permissions-Policy and Referrer-Policy; use `public/site.js` instead of an inline click handler. Admin dashboard keeps a private no-store and anti-frame policy. | Unit regression tests pass; rerun live smoke to verify newer deployment, and then check browser console in later mobile/performance phase. |
| P1 | Public production smoke hard-coded starter-guide slugs and regarded an intentionally absent ingest token as an authentication failure. | Detect currently published guides dynamically from sitemap, exercise anonymous read/write denial, report manual gates separately; accept 503 from disabled ingestion as fail-closed. | GitHub-hosted public run **36381010292: 10/10 automated checks**. |
| P1 | No repeatable local production D1 export script with integrity check existed. | Add `scripts/backup-d1.sh` with private-file permissions, nonempty/schema sanity check, UTC-dated filename and SHA-256 checksum. | CI checks Bash syntax only. Owner must run export and restore to a **separate staging DB**. |
| Monitor | Brute-force protection is per-IP via a hashed IP identity and D1 login-audit rows. | Keep strict random 32+ character key and six-attempt limit. | Mock tests exist; do not live-brute-force production. Consider Cloudflare edge rate limits if abusive distributed traffic develops. |
| Monitor | Published image URLs and R2 media are publicly retrievable even after article hiding/deletion; hard deletion only removes D1 records. | Preserve existing article/media separation and transparent destructive-action warning. | If storage cleanup becomes necessary, manually identify and delete **unreferenced** R2 objects after backup; never assume private media. |
| Monitor | Dependency installation has no committed lockfile and the Wrangler dev dependency uses a version range. | Track for reproducible-build work after launch gates; avoid claiming a complete supply-chain audit. | Pending separate dependency pin/lockfile decision. |

## Non-destructive owner runbook

### 1. Confirm the latest production deployment

- GitHub > Actions: confirm the latest `TripCaution checks` run is green for **the SHA intended for launch**.
- Cloudflare > Workers & Pages > `tripcaution` > Deployments: confirm the active Worker deployment corresponds to that exact GitHub commit. If no SHA is shown, compare deployment timestamp and asset markers, then check build logs. **Do not assume GitHub CI automatically proves production is current.**
- After the next change to `scripts/smoke-production.mjs`, the production smoke action runs automatically; it may also be run manually under GitHub Actions. The smoke never changes data.

### 2. Make a private D1 export

On your own Mac, where Wrangler is logged into the correct Cloudflare account:

```bash
git pull
npx wrangler login
bash scripts/backup-d1.sh "$HOME/tripcaution-secure-backups"
```

Record the printed backup file path and SHA-256 checksum. Keep the export and checksum outside public folders; **never upload this database to ChatGPT, GitHub or a public site**. If it fails the schema/nonempty check, stop. A SQL export is not a verified backup until recovery is tested.

### 3. Rehearse restoring to a separate staging database

Create a **new, separate** D1 database in the same account (do **not** overwrite `tripcaution-db`):

```bash
npx wrangler d1 create tripcaution-restore-check
npx wrangler d1 execute tripcaution-restore-check --remote --file="/FULL/PATH/TO/EXPORT.sql"
npx wrangler d1 execute tripcaution-restore-check --remote --command="SELECT COUNT(*) AS articles_count FROM articles;"
npx wrangler d1 execute tripcaution-restore-check --remote --command="SELECT COUNT(*) AS audit_count FROM audit_logs;"
```

The exact export command and restore workflow should be verified against the current Wrangler CLI version available on your machine. Do not bind the restore-check DB to the public Worker. Confirm article and audit counts match the original export. Clean up that staging database only after recovery is confirmed.

### 4. Check real owner authentication and backup recovery

In a new incognito browser, confirm `/admin` redirects to `/sign-in`; a correct private key grants the editorial interface, and Sign out clears the browser session. Test a draft `/admin/preview/<article-id>` from another unsigned browser (must redirect to login). Avoid repeatedly entering incorrect keys against production. Test only safe review/draft actions; permanent deletion and publish should be tried on **staging** with disposable sample records.

### 5. Activate a genuinely working public editorial contact

Do not set `EDITORIAL_CONTACT_VERIFIED` for a placeholder address such as a domain mailbox that has not been created. When you control an actual inbox, send and receive a genuine correction test email, then configure `EDITORIAL_CONTACT_EMAIL` and `EDITORIAL_CONTACT_VERIFIED=true` in Production Worker settings. Verify the public Contact page and noindex status. This operational gate cannot be established by a regex or homepage check.

## Current launch decision

**Automated production baseline:** recorded 10/10 at smoke run `36381010292`, before some later code hardening.  
**Latest code:** must pass its own GitHub checks and be observed on Cloudflare before claiming production verification.  
**Open manual blockers:** verified public inbox, latest deployment SHA, private auth in real browsers, actual D1 export+staging restore, editorial review of revised starter articles.  
**Mobile and performance:** intentionally deferred until the above Production & Security gate is resolved.  
**Broad launch:** NOT YET cleared.
