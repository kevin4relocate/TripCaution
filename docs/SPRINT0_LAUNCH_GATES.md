# TripCaution — Sprint 0 release gate status

**Updated:** 28 September 2026 (Singapore time)  
**Scope:** This Sprint changes Worker and CMS code and prepares revised source-based article copy. It does **not** grant repository access to Cloudflare account settings, send email, alter production D1 directly, or pretend that mock tests are live browser tests.

## Implemented in GitHub

- **P0 AI publication:** All bot and owner imports create private Review articles. The category-based `canAutoPublish` helper was removed. Bot tokens cannot use signed-owner revision features. Legacy bulk scheduling is disabled. Hourly Cron requires a saved human claim–source review record before it publishes any scheduled article.
- **P0 editorial accountability:** Owner approval requires all four checkboxes, a 30–1500 character claim–source note and a 7/30/90-day review interval. Records including the next due date are saved into existing D1 `audit_logs` (no migration needed). The dashboard flags public articles without a qualifying recorded human review or with an expired review period, and the owner can withdraw one into private Review.
- **P0 public policies:** About, Privacy and Contact were rewritten for actual current operations and external Google Fonts. A real, owner-approved public email is loaded from `EDITORIAL_CONTACT_EMAIL` (Cloudflare Production plaintext Variable). Missing email explicitly keeps Contact in pre-launch mode/noindex.
- **P0 domain consistency:** `/robots.txt` is now served dynamically from the same `SITE_URL` as canonical tags and sitemap. The old static robots.txt with the unrelated sitemap host was deleted.
- **P0 editorial updates:** Three starter guides in `content/starter-guides.json` were revised with a separate human-review checklist. Existing production D1 articles **have not been changed**; Admin now allows a deliberately confirmed revision import that immediately withdraws matching articles into Review.
- **P0 public smoke:** An independent Node smoke script and manual GitHub Action check health, homepage/canonical, directory, 3 guides, robots, sitemap, legal/contact pages, search/404, no-session Admin/API protection and sign-in without requesting any credentials.

## Evidence collected so far

An initial public GitHub-hosted smoke run checked the live Workers.dev origin and returned **9/10 PASS**. The only failing item was **Public policy and working contact configured** because `EDITORIAL_CONTACT_EMAIL` is not set. That check will remain failed until the owner configures a public address.

The smoke run was performed against the deployment available at that time. Do not claim it verified every later commit or the revised content import. Re-run the manual workflow once the most recent deployment and inbox setting are live.

## OWNER ACTION A — Publish a genuine corrections inbox

1. Choose a **dedicated editorial email address you consent to display publicly**. Do not share private passwords or the Admin key.
2. Cloudflare → Workers & Pages → `tripcaution` → Settings → **Variables and Secrets** → **Production** → **Add variable**. Choose **Variable** (this specific address is meant to be public), name `EDITORIAL_CONTACT_EMAIL`, value your dedicated public inbox. Save/Deploy the settings as prompted.
3. Open the public `/contact`, `/privacy` and `/about` pages. Confirm the address appears and no placeholder remains.
4. Send an actual correction-test email from a different email account. Confirm it reaches the inbox and you can reply. This is a required manual gate; automated HTML inspection cannot test deliverability.

## OWNER ACTION B — Safely apply and inspect the three edited articles

1. **Before updating production content**, export a D1 backup locally (Cloudflare Wrangler must already be logged in):
   ```bash
   npx wrangler d1 export tripcaution-db --remote --output=./tripcaution-prelaunch-backup.sql
   ```
   Keep the backup private and out of the public GitHub repository. Confirm that the file has nonzero size.
2. Download the updated `content/starter-guides.json` from GitHub. Sign in to `/admin` → Import content, choose the file, select **Apply corrections to matching existing slugs**, then carefully confirm the warning. All three matching public articles **temporarily disappear** from the public site until you reapprove them.
3. Follow `content/SPRINT0_EDITORIAL_REVIEW.md`. Check ALL important source links and claims independently, inspect private preview, finish the four checkboxes, enter a useful claim–source evidence note and choose a sensible next review interval (the historically dated Bangkok rain example deserves close monitoring). Approve and publish the three articles one at a time. If a claim cannot be verified, leave the affected guide in Review.
4. Return to the public URLs for Vietnam, Bangkok and Singapore and confirm they show the revised text, corrected fee distinction and date-sensitive caveats. The live published category for Singapore should now read Transport Cautions.

## OWNER ACTION C — Final production confirmation

1. Cloudflare → Workers & Pages → tripcaution → **Deployments**. Compare the active deployment to the current tested GitHub commit. A green GitHub check alone does not prove Cloudflare deployed that commit.
2. GitHub → **Actions → TripCaution production smoke → Run workflow**. Download the `tripcaution-public-smoke` artifact and confirm all public automated checks **10/10 PASS** after setting the public inbox and re-approving the guides.
3. On a **real iPhone Safari** and **Android Chrome**, check homepage lead article visible early, search keyboard behavior, country navigation, article title aligns with main image, no horizontal overflow, legible article headings/sources and functional links.
4. Use a fresh private browser to verify Admin signed-out redirect, correct-key sign-in, sign-out, expired-session behavior and that a draft preview is not public.
5. Cloudflare → Deployments → identify the last working version; rehearse **code rollback** on a safe staging deployment. **Worker rollback does not restore D1 content**. Restore the exported D1 to a staging database to verify the recovery steps without overwriting production.

## GO / NO-GO interpretation

- **Code controls:** implemented and unit-tested, with CI required on each new commit.
- **Live public smoke:** initial 9/10 passed. Contact remains a confirmed blocker.
- **Human-reviewed corrections on production:** pending the owner-run backed-up revision import and independent claim review.
- **Operational verification:** pending inbox receipt, latest-deployment SHA, manual iOS/Android tests and backup/rollback rehearsal.
- **Soft launch:** **NOT YET cleared** while these owner-only gates remain open. AdSense/SEO monetization readiness is outside Sprint 0 and should not be claimed.
