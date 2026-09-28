# TripCaution: Three researched field notes

**Editorial status: REVIEW REQUIRED.** Research checked on 28 September 2026 from linked government, transit-operator and airport sources. These are not invented first-hand travel reviews. Current conditions and operator rules must be verified again before approval.

The complete import package is [starter-guides.json](./starter-guides.json). It follows the Master Prompt v1 JSON format and includes three original ~800-word articles, direct source links, SEO fields and article-specific illustrations.

| Destination | Draft | Editorial review note |
| --- | --- | --- |
| Vietnam | Your First Taxi Ride in Vietnam: Seven Checks Before You Get In | Confirm nationality-specific vehicle-licence guidance if editing driving section |
| Bangkok, Thailand | Bangkok in Heavy Rain: A Smarter Airport Transfer Plan | **Time-sensitive.** Weather bulletin is dated 26 Sep 2026; recheck weather/transport immediately before publishing |
| Singapore | Singapore Transport Payments: What to Know Before Your First MRT Ride | Recheck the published SGD 0.60/day fee and card/transport support on current SimplyGo FAQ |

Cover art at `public/illustrations/vietnam-arrival.svg`, `bangkok-rain-rail.svg`, and `singapore-first-mrt.svg` is original AI-authored, watercolor-*inspired* vector editorial illustration, not a photograph or a Gemini-rendered watercolor. Each JSON article also provides a separate detailed Gemini hero image prompt should you wish to replace it later.

## Import

**Dashboard route:** Configure Cloudflare Access first, then open your live site's `/admin` > Import content. Paste the raw JSON object from `content/starter-guides.json` or upload the downloaded JSON file. Imported guides go to `review`. Check each one and click **Approve & publish** or **Approve & schedule**.

**One-click bot import:** Once the Cloudflare Worker has `INGEST_TOKEN` as an encrypted secret and GitHub has matching `TRIPCAUTION_INGEST_TOKEN` plus `TRIPCAUTION_API_URL`, run GitHub Actions > **Import TripCaution starter guides** > Run workflow. The importer checks source count and ensures every imported item reaches **review**, not immediate public publication.

Do NOT use both import methods on the same articles: duplicate slugs are intentionally rejected to protect content history.

## Why there is no automatic publication

Writing a source-grounded article and verifying that a source URL exists are not the same as a human editor approving every significant statement. The starter bundle intentionally enters the review queue. Publishing is a separate admin action and should happen only after source and freshness checks.
