# TripCaution batch 001 — 100 draft guides / 200 image slots

This batch is **research-first draft content** for the 3-year one-article-per-day plan. It is not approved for public release. Images are not present yet.

- Articles: 100 English drafts, one per calendar day from **2026-11-20 08:00 Asia/Bangkok** (01:00 UTC), for editorial planning only.
- Images: 200 WebP slots with deterministic upload pairing; #001–002 belong to article #1, #003–004 belong to article #2, etc.
- `articles.json`: article copy, provisional SEO fields, two independent country-level official research starting points, intended image URLs and planned dates.
- `image-manifest.json`: machine-readable naming / R2 keys / captions / alt text / prompts.
- `image-manifest.csv`: the same 200-image checklist for image production.
- `Images/`: user uploads `Gen_001.webp` through `Gen_200.webp` here. No need to rename manually.

**Important**: 110 prior published guides are in remote D1. Existing titles/slugs cannot be fully compared through this offline GitHub-only content creation. Check exact and semantic duplicates before an article is imported. Important claims, booking rules, safety advisories and dates need live primary-source confirmation, beyond the two general government advisory URLs in each draft. **Never auto-publish these drafts.**

Each article references `/media/editorial/<slug>.webp` (hero) and `/media/editorial/<slug>-inline-01.webp` (inline); the manual image workflow will upload these keys only after the user provides the WebP assets and explicitly triggers the workflow.

### Editorial release order
1. Review source relevance and update date; add the official operator/authority link that actually supports each material claim.
2. Confirm distinct angle vs live D1 inventory; merge or discard redundant draft, preserving mapping IDs for the remaining batch.
3. Confirm image matches article, alt and caption; use attribution/disclosure for generated illustration.
4. Upload images and verify R2 assets exist.
5. Import approved articles to private Review and schedule **one** for each date. The dates in JSON do not automatically schedule/publicly release anything.

The current website's existing Markdown renderer supports alt on inline images; the proposed individual captions are also stored in this manifest. A separate CMS/rendering change is required for structured per-image `figcaption` in the live site rather than a textual caption underneath the inline image.
