# TripCaution — Sprint 0 release gate status

**Updated:** 28 September 2026 (Singapore time)  
**Scope:** This Sprint changes Worker and CMS code and prepares revised source-based article copy. It does **not** grant repository access to Cloudflare account settings, send email, alter production D1 directly, or pretend that mock tests are live browser tests.

## Implemented in GitHub

- **P0 AI publication:** All bot and owner imports create private Review articles. The category-based `canAutoPublish` helper was removed. Bot tokens cannot use signed-owner revision features. Legacy unreviewed batch scheduling remains disabled. The new owner-authenticated selected-row bulk endpoint can schedule multiple individually selected articles only after an explicit owner review confirmation. Hourly Cron requires a qualifying old detailed review or new owner-confirmed scheduling record.
- **P0 editorial accountability:** Owner approval requires a deliberate Publish/Schedule action and a confirmation acknowledging review of the selected articles; there is no mandatory checklist or written note. The action records review time, single/bulk method and a default 30-day recheck date in existing D1 `audit_logs`. This is an approval record, **not proof of independent claim-by-claim verification**. The dashboard flags public articles without a qualifying recorded human review or with an expired review period, and the owner can withdraw one into private Review.
- **P0 public policies:** About, Privacy and Contact were rewritten for actual current operations and external Google Fonts. A real, owner-approved public email is loaded from `EDITORIAL_CONTACT_EMAIL` (Cloudflare Production plaintext Variable). Missing email explicitly keeps Contact in pre-launch mode/noindex.
- **P0 domain consistency:** `/robots.txt` is now served dynamically from the same `SITE_URL` as canonical tags and sitemap. The old static robots.txt with the unrelated sitemap host was deleted.
- **P0 editorial updates:** Three starter guides in `content/starter-guides.json` were revised with linked source-review notes for the owner to consult. Existing production D1 articles **have not been changed**; Admin now allows a deliberately confirmed revision import that immediately withdraws matching articles into Review.
- **P0 public smoke:** An independent Node smoke script and manual GitHub Action check health, homepage/canonical, directory, 3 guides, robots, sitemap, legal/contact pages, search/404, no-session Admin/API protection and sign-in without requesting any credentials.

## Evidence collected so far

An initial public GitHub-hosted smoke run checked the live Workers.dev origin and returned **9/10 PASS**. The only failing item was **Public policy and working contact configured** because `EDITORIAL_CONTACT_EMAIL` is not set. That check will remain failed until the owner configures a public address.

The smoke run was performed against the deployment available at that time. Do not claim it verified every later commit or the revised content import. Re-run the manual workflow once the most recent deployment and inbox setting are live.

## OWNER ACTION A — Publish a genuine corrections inbox

1. Choose a **dedicated editorial email address you consent to display publicly**. Do not share private passwords or the Admin key.
2. Cloudflare → Workers & Pages → `tripcaution` → Settings → **Variables and Secrets** → **Production** → **Add variable**. Choose **Variable** (this specific address is meant to be public), name `EDITORIAL_CONTACT_EMAIL`, value your dedicated public inbox. Save/Deploy the settings as prompted.
3. Open the public `/contact`, `/privacy` and `/about` pages. Confirm the address appears and no placeholder remains.
4. Send an actual correction-test email from a different email account. Confirm it reaches the inbox and you can reply. This is a required manual gate; automated HTML inspection cannot test deliverability. **Only after successful delivery**, also set the Production variable `EDITORIAL_CONTACT_VERIFIED=true`. Merely setting an email-shaped address intentionally does not display it publicly; this prevents placeholder mailboxes from misleading readers.

## OWNER ACTION B — Safely apply and inspect the three edited articles

1. **Before updating production content**, export a D1 backup locally (Cloudflare Wrangler must already be logged in):
   ```bash
   npx wrangler d1 export tripcaution-db --remote --output=./tripcaution-prelaunch-backup.sql
   ```
   Keep the backup private and out of the public GitHub repository. Confirm that the file has nonzero size.
2. Download the updated `content/starter-guides.json` from GitHub. Sign in to `/admin` → Import content, choose the file, select **Apply corrections to matching existing slugs**, then carefully confirm the warning. All three matching public articles **temporarily disappear** from the public site until you reapprove them.
3. Follow `content/SPRINT0_EDITORIAL_REVIEW.md`. Check ALL important source links and claims independently, inspect private preview, and publish each satisfactory article. If you previously reviewed the complete batch, you can select all three in **All articles** and confirm **Publish selected** once; this confirmation does not replace actual fact-checking. The next recheck date defaults to 30 days (Bangkok's weather example should be manually revisited sooner). If a claim cannot be verified, leave the affected guide in Review.
4. Return to the public URLs for Vietnam, Bangkok and Singapore and confirm they show the revised text, corrected fee distinction and date-sensitive caveats. The live published category for Singapore should now read Transport Cautions.

## Owner-controlled permanent deletion (optional)

Use **All articles → Deleted** to find recoverable deleted articles. **Restore selected** returns them to drafts. When genuinely ready to free database storage, **Delete permanently** removes only checked rows already in Deleted; **Empty Trash** removes *all* Deleted articles (not merely those loaded or filtered in the list). A prompt requires the exact phrase `PERMANENTLY DELETE`, and the server independently checks the selected IDs and current count before executing an atomic D1 batch. The operation also removes audit entries attached to those articles but keeps a small aggregate purge event for operational accountability. It does not delete R2 images, other database tables, or any Cloudflare backups. **Export and retain a D1 backup before using permanent deletion.** This action is not equivalent to resetting the entire D1 database.

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
