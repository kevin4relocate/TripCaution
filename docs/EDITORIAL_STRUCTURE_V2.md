# Editorial long-form format v2 — Batch 001, 002 and 003

**Scope:** 300 existing GitHub article drafts. This is a structure/SEO improvement, not approval to publish.

## What is standardized

The site's published guide layout continues to provide the dark hero, descriptive deck, AI-illustration disclosure, automatic **In this guide** table of contents, sticky sidebar, external **Sources & verification** list, canonical URL, OG image and article JSON-LD.

All 300 draft articles now have article-specific H2 headings based on the actual three preparation steps; Batch 002 and 003 also use their specific real-world example as a scenario heading. Each draft has a **Continue exploring** section linking to:
- a valid internal destination page (`/destinations/<country>`);
- a valid internal caution-topic page (`/cautions/<topic>`);
- the **same-page** source section via `#sources-and-verification`.

The renderer now supports safe internal destination/topic/guide routes and anchor links in Markdown (as well as HTTPS external links). Headings include their own clickable deep-link anchor. Image captions immediately following an inline Markdown image become a semantic `<figcaption>` instead of a blockquote. The hero image uses existing alt text in its caption plus its disclosure.

The existing related-guide cards query only *published* D1 articles, so the body does not link to future unpublished drafts. This reduces dead-end SEO links.

SEO titles no longer contain an embedded duplicate `| TripCaution` suffix because the page layout appends the brand itself; descriptions have been normalized to approximately 120–160 characters.

## What stays intact

All **600 image prompts, Gen_001–Gen_200 upload names, SEO output filenames, image alt fields, image captions, R2 keys and article slugs** are unchanged. Files in `content/batch-00X/image-manifest.csv` and `image-manifest.json` are not modified. The owner can continue generating images already in progress.

The 110 previously published D1 guides are unchanged by this GitHub content revision. Their **reader-side rendering** benefits from the same safe heading and caption behavior once the Worker is deployed, but their source data is not rewritten.

## Before publication

A GitHub build does **not** import or schedule these 300 drafts in D1. Their `planned_publish_at` values are editorial slots only, and all remain marked `REVIEW_REQUIRED_NOT_PUBLISHABLE_AS_IS`.

Existing country-level government advisory URLs are **research starting points**. They are not claim-by-claim support for each paragraph, and source dates should **not** be fabricated. Review topic-specific primary sources, source freshness, factual accuracy, SEO intent overlap with the D1 inventory, and correspondence between actual images and text before approving any article.

The upgrade is structural, not 300 manually researched and independently verified long-form reports.
