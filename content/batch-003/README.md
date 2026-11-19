# TripCaution: Batch 003 — 100 Evergreen Guides

## Status
**EDITORIAL DRAFTS — NOT APPROVED, NOT PUBLISHED, NOT SCHEDULED.** Planned dates are editorial slots only.

This is the third independent batch in the three-year editorial series.

- **100 articles** in English (about 850–890 words each), on travel decisions with durable value, such as walking accessibility, respectful travel, food questions, route and booking decisions, small-group safety and local crafts.
- **200 prompts** for hero/thumbnail and inline illustrations, with the same user-approved moody hand-painted gouache-and-ink TripCaution look.
- **Each image prompt calls for the exact lowercase watermark `tripcaution.com`.** Verify the lettering after generating the image; a prompt alone cannot guarantee exact AI text.
- **Image file mapping resets:** `Gen_001.webp` … `Gen_200.webp` under `Images/Batch-003/`, not the root Images folder.
- **Planned date range:** 08 June–15 September 2027 (one item daily, 08:00 Asia/Bangkok). These dates do not create D1 schedules.

## Files
- `editorial-plan.json` — 100 topics with an individual scenario and three useful checks.
- `articles.json` — articles, draft SEO fields, source starting points and planned daily slots.
- `image-manifest.json` — deterministic 200-image mapping with R2 keys, watermark, captions, alt text and prompts.
- `image-manifest.csv` — the same data as a flat image-production sheet.
- `IMAGE_STYLE.md` — art-direction instructions.
- `../../Images/Batch-003/README.md` — GitHub image upload folder.
- `../../scripts/batch-003-images.py` and `../../.github/workflows/batch-003-images.yml` — manual preview/upload workflow.

## Image naming
For every batch, `Gen_001` and `Gen_002` represent the first article; `Gen_199` and `Gen_200` represent the hundredth. The input images use a per-batch folder, but the R2 target is `editorial/<unique-article-slug>.webp` and `editorial/<unique-article-slug>-inline-01.webp`, matching the site's current `/media/editorial/` paths.

## Evergreen editorial standard
Each article addresses the procedure behind an ordinary travel decision instead of claiming immutable schedules, prices, weather, laws or visa arrangements. Information that could change must still be verified before release.

Batch 003 covers 10 Southeast Asian countries. Myanmar is not included because recent batches already cover travel warnings, and producing more evergreen-sounding tourism content about a high-sensitivity destination could be misleading.

**Outstanding review gates**:
1. The current 110 published guides are stored in remote D1; only Batch 001 and Batch 002 GitHub article slugs were checked for new-topic duplication. Compare true search-intent overlap with D1 before importing Batch 003.
2. The two official country-advisory URLs per draft are **starting points**, not verified support for every local statement. Check specific claims against the actual venue, authority or responsible operator.
3. Review the generated image against the alt and caption before use.
4. Editorial approval remains separate from upload. Uploading images to R2 does not publish an article or activate its planned date.
